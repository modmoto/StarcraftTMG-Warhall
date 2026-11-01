export const markerDiameterMm = 32; // The clickable footprint is independent of the visual control ring.
export const controlRangeInches = 3;
export const nativeMarkers = [
  { color: 'red', skinId: 6201, resource: 'Tokens/ExcaliburRed' },
  { color: 'blue', skinId: 6202, resource: 'Tokens/ExcaliburBlue' },
  { color: 'green', skinId: 6203, resource: 'Tokens/ExcaliburGreen' },
];

export function markerTokens() {
  return [
    ...nativeMarkers.map(({ color }) => ({
      Id: `sc_mission_${color}`,
      Name: `Mission marker - ${color}`,
      Type: 'Token',
      Description: `${color[0].toUpperCase() + color.slice(1)} mission marker. Mission-marker affinity: red 1/3, blue 2/4, green neutral 5. 32 mm marker; distances measure from the base edge. The decorative control ring extends 3 inches from that edge and has no separate selection footprint. Activation and control are manual.`,
    })),
  ];
}
export function markerTerrains() {
  return markerTokens().map(t => ({
    ...t,
    Type: 'Terrain',
    Width: markerDiameterMm / 10,
    Length: markerDiameterMm / 10,
    Height: 0.2,
    Shape: 1,
  }));
}
