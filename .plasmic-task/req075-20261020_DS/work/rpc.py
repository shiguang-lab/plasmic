"""Thin wrapper over the documented authenticated local RPC transport."""
import sys, json, os
sys.path.insert(0, "/Users/yanxianliang/Library/Caches/Plasmic/skill-resources/fde603147191239d/b6625b87b5d40d1d29f578a4fb41cfefdf615776dcd8ae0414e29eff153f64f7/scripts")
from verify_all import Desktop

PROFILE = "/Users/yanxianliang/Library/Application Support/Plasmic Desktop"
_d = None
def desktop():
    global _d
    if _d is None:
        from pathlib import Path
        _d = Desktop(Path(PROFILE))
    return _d

def op(operation, **inp):
    return desktop().execute(operation, inp)

def tool(name, **args):
    return desktop().call(name, args)
