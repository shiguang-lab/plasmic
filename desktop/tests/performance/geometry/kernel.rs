// Diagnostic scalar kernel. No allocator, dependencies, SIMD or model objects.
#![no_std]
use core::panic::PanicInfo;
#[panic_handler]
fn panic(_: &PanicInfo) -> ! { loop {} }
static mut SCRATCH: [u64; 131072] = [0; 131072];
#[no_mangle]
pub extern "C" fn scratch_ptr() -> *mut u64 { &raw mut SCRATCH as *mut u64 }
#[no_mangle]
pub extern "C" fn capacity() -> u32 { 1048576 }
#[no_mangle]
pub unsafe extern "C" fn contains(
    ptr: *const f64, len: u32, out: *mut u8,
    fl: f64, ft: f64, fr: f64, fb: f64,
    ql: f64, qt: f64, qr: f64, qb: f64,
) {
    for i in 0..len as usize {
        let p = ptr.add(i * 4);
        let (l,t,r,b) = (*p,*p.add(1),*p.add(2),*p.add(3));
        // Same finite DOM-rectangle semantics as Box.intersects/containsBox.
        *out.add(i) = (f64::max(fl,l) < f64::min(fr,r)
            && f64::max(ft,t) < f64::min(fb,b)
            && ql <= l && qr >= r && qt <= t && qb >= b) as u8;
    }
}
