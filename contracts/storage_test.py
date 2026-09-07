# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

# Minimal smoke-test contract. Deploy this FIRST on GenLayer Studio to confirm the
# environment works (correct version pragma, storage types, schema loads) before
# blaming proof_of_sweat.py for any deploy error. See scripts/deploy/DEPLOY.md.


class Contract(gl.Contract):
    counter: bigint
    note: str

    def __init__(self):
        self.counter = bigint(0)
        self.note = "proof-of-sweat storage ok"

    @gl.public.write
    def bump(self) -> None:
        self.counter = self.counter + bigint(1)

    @gl.public.view
    def get_counter(self) -> int:
        return int(self.counter)

    @gl.public.view
    def get_note(self) -> str:
        return self.note
