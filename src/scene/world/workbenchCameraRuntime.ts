// Hand-off between the workbench camera rig and the first-person controller
// (same pattern as meleeRuntime). While `active`, the rig owns the camera and
// the controller must not write it, otherwise the two fight every frame.
export const workbenchCameraRuntime = {
  active: false,
}
