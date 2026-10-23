# India pincode coordinates

`indian-pincode-coordinates.json` is derived from the GeoNames India postal-code archive: <https://download.geonames.org/export/zip/IN.zip>.

Attribution: GeoNames, <https://www.geonames.org>, licensed under Creative Commons Attribution 3.0 (<https://creativecommons.org/licenses/by/3.0/>). The data was downloaded on 2026-10-23. GeoNames' postal-code directory lists `IN.zip` as last modified on 2015-06-15; its readme states that Indian postal-coordinate accuracy is not comparable to other countries and provides no accuracy, timeliness, or completeness warranty.

The archive contained 155,570 coordinate rows for 19,238 unique six-digit Indian pincodes. Some pincodes have multiple distinct points; this lookup selects the most frequently repeated coordinate for each pincode, breaking ties by the higher GeoNames accuracy value, then by coordinate order. This produces one representative point per pincode, not a precise center or the full extent of its postal area.

Haversine results are approximate straight-line distances between those representative points. They are not road or courier-route distances. Keep zone pricing available and verify the configured charges against actual courier rates before enabling distance pricing.
