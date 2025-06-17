---
applyTo: '**'
---

<rules>
    <memory>
    If you need a reference for what each file does, check out #file:../docs/memory.md

    When you create a new file, update #file:../docs/memory.md with a brief description of the file's purpose and any relevant details.
    </memory>
    
    <context>
    If you lack context on how to solve the user's request:
    
    FIRST, use #tool:resolve-library-id from Context7 to find the referenced library.

    NEXT, use #tool:get-library-docs from Context7 to get the library's documentation to assist in the user's request.
    </context>
</rules>