DELETE FROM collaborators
WHERE role IN ('owner', 'viewer');

UPDATE collaborators
SET role = 'editor'
WHERE role <> 'editor';
