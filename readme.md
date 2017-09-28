# Delete Duplicates

Deletes files in a "source" directory, when they are duplicates of files in a "target" directory.

 - Duplicates are determined by MD5 hash.
 - The deletion can optionally move files to specified "recycle" directory, rather than delete. This gives you an opportunity to check or archive them before final deletion.
 - The directory for deletion (named the "source") may overlap with the directory for duplicates (the "targets"). For example, to delete files that are "elsewhere" in the set of directories.
 - If a file exists multiple times in the source directory, these are not considered to be duplicates of each other, even if the source directory is a subdirectory of the target. The reason for this, is so that any files left over in the source directory maintain a "clean" structure, rather than randomly choosing which of the multiple duplicates to delete and thus potentially choosing the "wrong" duplicate. These will be issued as warnings.







