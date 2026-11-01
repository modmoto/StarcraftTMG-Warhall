export const markerDiameterMm = 32; // The clickable footprint is independent of the visual control ring.
export const controlRangeInches = 3;
export const nativeMarkers = [
  { color: 'red', skinId: 6201, resource: 'Tokens/ExcaliburRed' },
  { color: 'blue', skinId: 6202, resource: 'Tokens/ExcaliburBlue' },
  { color: 'green', skinId: 6203, resource: 'Tokens/ExcaliburGreen' },
];

export const missionMarkers = Array.from({ length: 5 }, (_, index) => {
  const number = index + 1;
  const color = number === 5 ? 'green' : number % 2 ? 'red' : 'blue';
  const suffix = number === 3 || number === 4 ? `_${number}` : '';
  return {
    number,
    color,
    profileId: `sc_mission_${color}${suffix}`,
    ...(suffix
      ? {}
      : { replacesNativeSkinId: nativeMarkers.find(marker => marker.color === color).skinId }),
  };
});

export function markerProfileId({ number, color }) {
  const marker = missionMarkers.find(marker => marker.number === number && marker.color === color);
  if (!marker) throw new Error(`Unknown mission marker: ${number}/${color}`);
  return marker.profileId;
}

export function markerTokens() {
  return missionMarkers.map(({ number, color, profileId }) => ({
    Id: profileId,
    Name: `Mission marker ${number} - ${color}`,
    Type: 'Token',
    Description: `Mission marker ${number}. 32 mm circular selection and measurement footprint. Open sci-fi outline with a transparent interior and a numbered center. The outline extends 3 inches from the marker edge. Activation and control are manual.`,
  }));
}
export function markerTerrains() {
  return markerTokens().map(marker => ({
    ...marker,
    Type: 'Terrain',
    Width: markerDiameterMm / 10,
    Length: markerDiameterMm / 10,
    Height: 0.2,
    Shape: 1,
  }));
}
