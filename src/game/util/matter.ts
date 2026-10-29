import Phaser from "phaser";

/** Matter's static `Body` helpers (setVelocity, setMass...), as bundled with Phaser. */
export const Body: typeof MatterJS.Body = (Phaser.Physics.Matter as unknown as { Matter: { Body: typeof MatterJS.Body } }).Matter.Body;
