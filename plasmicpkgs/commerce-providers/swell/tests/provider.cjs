const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const load = createRequire(path.join(process.env.CONSUMER_DIR, 'package.json'));
const { getCommerceProvider } = load(process.env.SWELL_MODULE || '@plasmicpkgs/commerce-swell');

test('Swell provider preserves product, category, brand, cart and error contracts through the real SDK', async () => {
  const provider = getCommerceProvider('public-types-test', 'pk_fixture')({}).props.provider;
  const requests = [];
  const product = {id:'p1', name:'Coffee', slug:'coffee', description:'Roasted', price:12, currency:'USD', images:[{file:{url:'https://fixture.invalid/coffee.png',width:80,height:60}}]};
  const cart = {id:'cart1', account_id:'a1',date_created:'2026-11-06',currency:'USD',tax_included_total:0,items:[],sub_total:24,grand_total:24,discounts:[]};
  const originalFetch = global.fetch;
  let fail = false;
  global.fetch = async (url, init) => {
    const parsed = new URL(url);
    requests.push({path:parsed.pathname, query:parsed.searchParams, method:init.method.toLowerCase(), body:init.body && JSON.parse(init.body), headers:init.headers});
    let body;
    if (fail) return new Response(JSON.stringify({error:{message:'Out of stock',code:'stock_error',param:'quantity'}}),{status:422});
    if (parsed.pathname === '/api/products/p1') body = product;
    else if (parsed.pathname === '/api/products') body = {results:[product], count:1};
    else if (parsed.pathname === '/api/categories') body = {results:[{id:'c1',name:'Drinks',slug:'drinks',parent_id:null,children:{results:[]}}]};
    else if (parsed.pathname === '/api/attributes/brand') body = {values:['Acme','Acme','Other']};
    else if (parsed.pathname.startsWith('/api/cart')) body = cart;
    else throw new Error(`Unexpected SDK request: ${url}`);
    return new Response(JSON.stringify(body),{status:200,headers:{'X-Session':'fixture-session'}});
  };
  try {
    async function run(hook, input) { return hook.fetcher({input, options:hook.fetchOptions,fetch:provider.fetcher}); }
    const search = await run(provider.products.useSearch,{search:'coffee',sort:'price-desc',count:3,categoryId:'c1',brandId:'Acme'});
    assert.equal(search.found,true); assert.equal(search.products[0].path,'/coffee');
    assert.deepEqual(search.products[0].price,{value:12,currencyCode:'USD'});
    assert.equal(search.products[0].images[0].url,product.images[0].file.url);
    assert.equal(requests.at(-1).query.get('search'),'coffee');
    assert.equal(requests.at(-1).query.get('sort'),'price desc');
    assert.equal(requests.at(-1).query.get('limit'),'3');
    const single = await run(provider.products.useProduct,{id:'p1'}); assert.equal(single.id,'p1');
    const categories = await run(provider.site.useCategories,{}); assert.equal(categories[0].name,'Drinks');
    const brands = await run(provider.site.useBrands,{}); assert.deepEqual(brands.map(x=>x.name),['Acme','Other']);
    const initial = await run(provider.cart.useCart,{}); assert.equal(initial.id,'cart1'); assert.equal(initial.totalPrice,24);
    await run(provider.cart.useAddItem,{productId:'p1',variantId:'v1',quantity:2});
    assert.equal(requests.at(-1).path,'/api/cart/items'); assert.equal(requests.at(-1).method,'post');
    assert.equal(requests.at(-1).body.product_id,'p1'); assert.equal(requests.at(-1).body.variant_id,'v1'); assert.equal(requests.at(-1).body.quantity,2);
    await run(provider.cart.useUpdateItem,{itemId:'line1',item:{quantity:3}});
    assert.equal(requests.at(-1).path,'/api/cart/items/line1');assert.equal(requests.at(-1).method,'put');assert.deepEqual(requests.at(-1).body,{quantity:3});
    await run(provider.cart.useRemoveItem,{itemId:'line1'}); assert.equal(requests.at(-1).method,'delete');
    const count = requests.length;
    await assert.rejects(run(provider.cart.useAddItem,{productId:'p1',quantity:-1}),/valid integer/);
    assert.equal(requests.length,count);
    await run(provider.cart.useUpdateItem,{itemId:'line1',item:{quantity:0}});assert.equal(requests.at(-1).method,'delete');
    await assert.rejects(provider.fetcher({query:'missing',method:'get'}),/Invalid query/);
    fail = true;
    await assert.rejects(provider.fetcher({query:'products',method:'get',variables:'error-product'}),error=>error.message==='Out of stock'&&error.code==='stock_error'&&error.status===422);
    assert.ok(requests.every(r=>r.headers.Authorization==='Basic '+Buffer.from('pk_fixture').toString('base64')));
    // The default server SDK intentionally has no browser cookie storage.
    assert.ok(requests.every(r=>r.headers['X-Session']===undefined));
    console.log(JSON.stringify({sdk:provider.swell.version,requests:requests.map(({path,method})=>({path,method}))}));
  } finally { global.fetch = originalFetch; }
});
