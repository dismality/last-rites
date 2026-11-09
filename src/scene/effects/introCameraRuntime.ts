// Hand-off between the intro camera and the first-person controller (same pattern as
// endingCameraRuntime): while `active`, the intro camera owns the camera.
export const introCameraRuntime = {
  active: false,
  /** Seconds into the intro. */
  time: 0,
  /** Whether the shot 4 grave burst has been queued this playthrough. */
  burstFired: false,
}
