// Existing public Warhall assets, verified in the test client's skin catalogue.
// Explicit SkinId bypasses missing per-game item/costume associations.
export const markerDiameterMm = 32; // Rules measurement; native placeholder size is unchanged.
export const controlRangeInches = 3;
export const nativeMarkers = [
  { color: 'red', skinId: 6201, resource: 'Tokens/ExcaliburRed' },
  { color: 'blue', skinId: 6202, resource: 'Tokens/ExcaliburBlue' },
  { color: 'green', skinId: 6203, resource: 'Tokens/ExcaliburGreen' },
];

export function markerTokens() {
  return nativeMarkers.map(({ color, skinId }) => ({
    Id: `sc_mission_${color}`,
    Name: `Mission marker - ${color}`,
    Type: 'Token',
    SkinId: skinId,
    Description: `Existing Warhall ${color} marker. Mission-marker affinity: red 1/3, blue 2/4, green neutral 5. Activation and control are manual. Native marker dimensions are retained.`,
  }));
}
