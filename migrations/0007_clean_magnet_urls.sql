UPDATE resources
SET
  url = 'magnet:?xt=urn:btih:' || upper(trim(url)),
  updated_at = CURRENT_TIMESTAMP
WHERE
  type = 'magnet'
  AND lower(trim(url)) NOT LIKE 'magnet:%'
  AND length(trim(url)) = 40
  AND trim(url) NOT GLOB '*[^0-9A-Fa-f]*';

UPDATE resource_submissions
SET
  url = 'magnet:?xt=urn:btih:' || upper(trim(url)),
  updated_at = CURRENT_TIMESTAMP
WHERE
  type = 'magnet'
  AND lower(trim(url)) NOT LIKE 'magnet:%'
  AND length(trim(url)) = 40
  AND trim(url) NOT GLOB '*[^0-9A-Fa-f]*';
