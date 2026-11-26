# WDS editor comparison

The generators and reviewed JSON in this repository are authoritative. Before incorporating a web-editor export, download its ZIP and run:

```sh
python scripts/imports/compare-wds-export.py EXPORT.zip
```

Review missing records, IDs/names, dimensions, rule descriptions and fields such as IsTemplate and IsBaseTransparent. Retain helper records and map/deployment references that the editor may not display. Opening a panel is not authorization to replace the maintained dataset with a normalized draft.

Merge intended changes into source generators and calibration inputs, regenerate, and validate. Keep manifest.json and version.json versions aligned for actual data changes. Shared skin-name aliases must match the published default skins; synchronize and read back those bindings after asset publication.

Historical client debugging and developer handoff reports have been removed. UI/client behavior is maintained in the separate Warhall code repository.
