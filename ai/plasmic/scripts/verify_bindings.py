"""Narrow, non-executing checks for public model bindings.

Only the documented role-preserving menu transform and flat object literals with
literal/simple read bindings are recognized. Unknown JavaScript fails closed.
"""
import json
import re


# Match operators as complete lexemes: `= >` must not equal `=>`.
TOKEN = re.compile(r'''[ \t\r\n]+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][A-Za-z0-9_$]*|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|>>>=|===|!==|\*\*=|&&=|\|\|=|\?\?=|>>>|<<=|>>=|\.\.\.|=>|\?\.|\|\||&&|\?\?|==|!=|\+\+|--|\*\*|<=|>=|[+*/%&|^!-]=|<<|>>|[^ \t\r\n]''')
READ = re.compile(r'\$(?:state|ctx)(?:\??\.[A-Za-z_$][A-Za-z0-9_$]*)+')
IDENTIFIER = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*')


def tokens(source):
    result = []
    line_break = False
    for match in TOKEN.finditer(source):
        token = match.group()
        if token[0] in ' \t\r\n':
            line_break = line_break or '\n' in token or '\r' in token
            continue
        if line_break and (token == '=>' or (result and result[-1] == ('token', 'return'))):
            raise ValueError('Line break changes the supported menu program')
        line_break = False
        if token.startswith(('"', "'")):
            if token.startswith("'"):
                # Keep the accepted JavaScript subset unambiguous: Python string
                # escapes are not a JavaScript parser. Escaped strings use JSON.
                if not token.endswith("'") or '\\' in token or any(ord(c) < 32 for c in token):
                    raise ValueError('Unsupported single-quoted binding token')
                value = token[1:-1]
            else:
                try:
                    value = json.loads(token)
                except ValueError as error:
                    raise ValueError('Invalid JSON binding token') from error
            result.append(('string', value))
        else:
            result.append(('token', token))
    return result


def role_menu(items, contract, actual):
    """Prove the entire transform, including recursion and fallback precedence.

    The source-reviewed literal inventory remains authoritative. Matching a small
    generated program proves its behavior for every role value, without running
    JavaScript or accepting arbitrary expressions supplied by the model.
    """
    if not isinstance(contract, dict) or set(contract) != {'state', 'query', 'default'}:
        raise ValueError('roleQuery requires exactly state, query and default')
    if any(not isinstance(contract[k], str) for k in contract):
        raise ValueError('roleQuery fields must be strings')
    if not all(IDENTIFIER.fullmatch(contract[k]) for k in ('state', 'query')) or not contract['default']:
        raise ValueError('roleQuery requires simple state/query names and nonempty default')
    def literal(value):
        if isinstance(value, dict):
            if '__proto__' in value:
                raise ValueError('Prototype keys are not JSON-equivalent JavaScript object literals')
            if isinstance(value.get('href'), str) and any(c in value['href'] for c in '?#'):
                raise ValueError('roleQuery requires hrefs without an existing query or fragment')
            for child in value.values():
                literal(child)
        elif isinstance(value, list):
            for child in value:
                literal(child)
    literal(items)
    role = f"($state.{contract['state']} || $ctx.query?.{contract['query']} || {json.dumps(contract['default'], ensure_ascii=False)})"
    expected = "{{ (()=>{const map=items=>items.map(item=>({...item,...(item.href?{href:item.href+'?role='+encodeURIComponent(" + role + ")}:{}),...(item.children?{children:map(item.children)}:{})}));return map(" + json.dumps(items, ensure_ascii=False, allow_nan=False) + ");})() }}"
    if not isinstance(actual, str) or tokens(actual) != tokens(expected):
        raise ValueError('Dynamic menu differs from reviewed roleQuery transform or literal menu inventory')
    return items


def object_binding(value):
    """Read a flat object expression; never execute values or accept spreads.

    Expressions in values are preserved as bindings for independent prop checks.
    Only simple $state/$ctx property reads are supported; methods, computed keys,
    nested objects, assignments and other expressions remain unresolved.
    """
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.startswith('{{') or not value.endswith('}}'):
        raise ValueError('Unresolved native Button props require a supported object binding')
    source = value[2:-2].strip(' \t\r\n')
    if source.startswith('(') and source.endswith(')'):
        source = source[1:-1].strip(' \t\r\n')
    if not source.startswith('{') or not source.endswith('}'):
        raise ValueError('Native Button props must be a flat object literal')
    result = {}
    body = source[1:-1].strip(' \t\r\n')
    for entry in body.split(',') if body else []:
        match = re.fullmatch(r'[ \t\r\n]*([A-Za-z_$][A-Za-z0-9_$]*)[ \t\r\n]*:[ \t\r\n]*(.*?)[ \t\r\n]*', entry, re.S)
        if not match or match[1] in result or match[1] == '__proto__':
            raise ValueError('Unsupported or duplicate native Button prop')
        key, expression = match.groups()
        if expression in {'NaN', 'Infinity', '-Infinity'}:
            raise ValueError('Native Button values must be literals or simple reads')
        if READ.fullmatch(expression):
            result[key] = '{{ ' + expression + ' }}'
        else:
            try:
                parsed = json.loads(expression)
            except ValueError as error:
                raise ValueError('Unsupported native Button prop value') from error
            if isinstance(parsed, (dict, list)):
                raise ValueError('Nested native Button bindings require explicit evidence')
            if isinstance(parsed, str) and ('{{' in parsed or '}}' in parsed):
                raise ValueError('Literal Button text cannot masquerade as a read binding')
            result[key] = parsed
    return result
