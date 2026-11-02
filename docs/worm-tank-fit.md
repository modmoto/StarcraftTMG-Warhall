# Omega Worm and Siege Tank footprint corrections

The Omega Worm profile uses an 80 mm circular base. The prior uniform Unity-prefab layout rendered much wider than that base. The source inventory contains two flat ground-marker meshes and one emerged Nydus body, available as both OBJ and Unity geometry; no distinct taller emerged pose was found in this TTS set. The replacement uses the emerged OBJ and its original diffuse texture. It is centered and grounded, with every vertex (including the outer spikes) inside a 38 mm radius, leaving 2 mm to the base rim. Its resulting height is approximately 42 mm. It is not a newly authored or stretched pose.

`node scripts/fit-omega-worm.mjs` reproduces the selection and fit. It updates the persistent selections/adjustments and `omega-worm-fit-report.json`. Running the legacy selection script retains the adjustment. Source URLs and TTS object identifiers remain in the selection record.

The deployed Siege Tank retains the existing mesh and blue texture. A 15% increase slightly exceeded its 150 mm circular base, so its final size is approximately 13.3% larger than the former 1.47 layout scale. Its furthest geometry touches the 75 mm base radius. `node scripts/fit-siege-tank.mjs` reproduces the fit and writes `siege-tank-fit-report.json`; centering and ground clearance scale with the model.

After fitting, run `models:catalogue`, inspect top and perspective renders with actual base outlines, push, then publish only these two selected unit entries. Neither WDS base sizes nor unrelated skin assignments change. API readback confirms stored transforms; in-client visual verification remains separate.
