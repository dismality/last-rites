// Hand-off between the ending camera, the ending UI and the first-person controller
// (same pattern as workbenchCameraRuntime): while `active`, the ending camera owns the
// camera, and `time` is the sequence clock the subtitles follow.
export const endingCameraRuntime = {
  active: false,
  /** Seconds into the current ending sequence. */
  time: 0,
}
