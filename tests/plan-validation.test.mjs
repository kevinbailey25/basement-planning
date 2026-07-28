import assert from "node:assert/strict";
import test from "node:test";

import { hvacWallCavityReturn, hvacWallDuctedReturn } from "../lib/plan/helpers.ts";
import { pocPlan } from "../lib/plan/poc-plan.ts";
import { validatePlan } from "../lib/plan/validate.ts";

test("POC plan has valid references and unique IDs", () => {
  assert.deepEqual(validatePlan(pocPlan), []);
});

test("office door hinges on its south end and swings inward", () => {
  const officeDoor = pocPlan.doors.find((door) => door.id === "office-door");
  assert.ok(officeDoor);
  assert.equal(officeDoor.hinge, "end");
  assert.equal(officeDoor.swing, "inward");
});

test("stores the Utility Room construction scope and final footprint", () => {
  const utility = pocPlan.spaces.find((space) => space.id === "furnace-room");
  const eastWall = pocPlan.walls.find((wall) => wall.id === "utility-room-east-wall");
  const northExtension = pocPlan.walls.find((wall) => wall.id === "utility-room-north-wall-east-extension");
  const oldEastWall = pocPlan.walls.find((wall) => wall.id === "furnace-room-east-wall");
  const oldStorageWall = pocPlan.walls.find((wall) => wall.id === "furnace-room-storage-wall");
  assert.ok(utility && eastWall && northExtension && oldEastWall && oldStorageWall);
  assert.equal(utility.label, "Utility Room");
  assert.deepEqual(utility.polygon, [[375, 186], [556, 186], [556, 267], [375, 267]]);
  assert.deepEqual([eastWall.from, eastWall.to, eastWall.status], [[375, 186], [556, 186], "proposed"]);
  assert.deepEqual([northExtension.from, northExtension.to, northExtension.status], [[375, 222], [375, 186], "proposed"]);
  assert.equal(oldEastWall.status, "remove");
  assert.equal(oldStorageWall.status, "remove");
});

test("stores the new Utility door and relocated Storage door", () => {
  const utilityDoor = pocPlan.doors.find((door) => door.id === "utility-room-door");
  const storageDoor = pocPlan.doors.find((door) => door.id === "storage-door");
  assert.ok(utilityDoor && storageDoor);
  assert.deepEqual(
    [utilityDoor.wallId, utilityDoor.offset, utilityDoor.width, utilityDoor.hinge, utilityDoor.swing, utilityDoor.height],
    ["utility-room-east-wall", 6, 36, "start", "inward", undefined],
  );
  assert.deepEqual([storageDoor.wallId, storageDoor.offset, storageDoor.width], ["storage-north-wall", 120, 32]);
});

test("stores the Office recessed-light group in clear joist bays", () => {
  const switchItem = pocPlan.switches.find((item) => item.id === "office-entry-light-switch");
  const group = pocPlan.circuits.find((item) => item.id === "office-lighting-group");
  assert.ok(switchItem && group);
  assert.deepEqual(pocPlan.lights.filter((item) => item.id.startsWith("office-")).map((item) => item.at), [
    [55.5, 378],
    [135, 378],
    [55.5, 478],
    [135, 478],
  ]);
  assert.deepEqual([switchItem.wallId, switchItem.offset], ["office-east-divider", 141]);
  assert.deepEqual(group.connections, [
    { fromId: "office-entry-light-switch", toId: "office-light-southeast" },
    { fromId: "office-light-southeast", toId: "office-light-northeast" },
    { fromId: "office-light-northeast", toId: "office-light-northwest" },
    { fromId: "office-light-northwest", toId: "office-light-southwest" },
  ]);
  assert.match(group.note, /do not represent cable routing/);
});

test("stores the Bathroom recessed-light group and entry switch", () => {
  const switchItem = pocPlan.switches.find((item) => item.id === "bathroom-entry-light-switch");
  const group = pocPlan.circuits.find((item) => item.id === "bathroom-lighting-group");
  const bathroomLights = pocPlan.lights.filter((item) => item.id.startsWith("bathroom-"));
  assert.ok(switchItem && group);
  assert.deepEqual(
    bathroomLights.map((item) => [item.at, item.fixture]),
    [
      [[30, 297], "recessed"],
      [[73.5, 297], "recessed"],
      [[114.5, 309], "recessed"],
    ],
  );
  assert.deepEqual(
    [switchItem.wallId, switchItem.offset, switchItem.wallSide, switchItem.controlType, switchItem.gangIndex, switchItem.gangCount],
    ["main-west-divider", 90, "right", "standard", 2, 2],
  );
  assert.deepEqual(group.connections, [
    { fromId: "bathroom-entry-light-switch", toId: "bathroom-vanity-south-recessed-light" },
    { fromId: "bathroom-vanity-south-recessed-light", toId: "bathroom-central-recessed-light" },
    { fromId: "bathroom-central-recessed-light", toId: "bathroom-tub-shower-recessed-light" },
  ]);
  assert.match(group.note, /do not represent cable routing/);
});

test("stores the existing stair light and proposed Landing light on the shared stair control group", () => {
  const switchItem = pocPlan.switches.find((item) => item.id === "stair-landing-three-way-switch");
  const existingLight = pocPlan.lights.find((item) => item.id === "main-stair-existing-recessed-light");
  const landingLight = pocPlan.lights.find((item) => item.id === "stair-landing-recessed-light");
  const group = pocPlan.circuits.find((item) => item.id === "stair-landing-lighting-group");
  assert.ok(switchItem && existingLight && landingLight && group);
  assert.deepEqual(
    [switchItem.wallId, switchItem.offset, switchItem.wallSide, switchItem.controlType, switchItem.gangIndex, switchItem.gangCount, switchItem.status],
    ["main-west-divider", 181.5, "right", "standard", 2, 2, "existing"],
  );
  assert.deepEqual(
    [existingLight.at, existingLight.fixture, existingLight.status],
    [[256, 285], "recessed", "existing"],
  );
  assert.deepEqual(
    [landingLight.at, landingLight.fixture, landingLight.status],
    [[160, 298], "recessed", "proposed"],
  );
  assert.equal(group.status, "proposed");
  assert.deepEqual(group.connections, [
    { fromId: "stair-landing-three-way-switch", toId: "main-stair-existing-recessed-light" },
    { fromId: "main-stair-existing-recessed-light", toId: "stair-landing-recessed-light" },
  ]);
  assert.match(group.note, /companion switch at the top of the stairs is intentionally not shown/);
  assert.match(group.note, /do not represent cable routing/);
});

test("stores the Bathroom exhaust fan endpoint and timer control separately from its HVAC duct", () => {
  const fan = pocPlan.exhaustFans.find((item) => item.id === "bathroom-ceiling-exhaust-fan");
  const timer = pocPlan.switches.find((item) => item.id === "bathroom-entry-exhaust-fan-timer");
  const group = pocPlan.circuits.find((item) => item.id === "bathroom-exhaust-fan-control-group");
  const duct = pocPlan.hvacDucts.find((item) => item.id === fan?.hvacDuctId);
  assert.ok(fan && timer && group && duct?.orientation === "horizontal");
  assert.deepEqual([fan.at, fan.mounting, fan.hvacDuctId], [[53, 311], "ceiling", "bathroom-north-wall-exhaust-fan-04"]);
  assert.deepEqual(fan.at, duct.from);
  assert.deepEqual(
    [timer.wallId, timer.offset, timer.wallSide, timer.controlType, timer.gangIndex, timer.gangCount],
    ["main-west-divider", 90, "right", "timer", 1, 2],
  );
  assert.equal(group.layer, "ventilation-control");
  assert.deepEqual(group.connections, [
    { fromId: "bathroom-entry-exhaust-fan-timer", toId: "bathroom-ceiling-exhaust-fan" },
  ]);
  assert.match(group.note, /does not represent cable routing/);
});

test("reports invalid exhaust-fan sources and incomplete switch gang metadata", () => {
  const invalidFanPlan = {
    ...pocPlan,
    exhaustFans: [{ ...pocPlan.exhaustFans[0], hvacDuctId: "main-return-ceiling-trunk" }],
  };
  const invalidSwitchPlan = {
    ...pocPlan,
    switches: [{ ...pocPlan.switches[0], gangCount: undefined }],
  };
  assert.ok(validatePlan(invalidFanPlan).some((issue) => issue.code === "missing-hvac-source"));
  assert.ok(validatePlan(invalidFanPlan).some((issue) => issue.code === "invalid-exhaust-fan"));
  assert.ok(validatePlan(invalidSwitchPlan).some((issue) => issue.code === "invalid-switch"));
});

test("stores one Bathroom GFCI receptacle beside the vanity", () => {
  const bathroomReceptacles = pocPlan.receptacles.filter((item) => item.id.startsWith("bathroom-"));
  assert.deepEqual(
    bathroomReceptacles.map((item) => [
      item.wallId,
      item.offset,
      item.wallSide,
      item.heightAboveFloor,
      item.receptacleType,
    ]),
    [["bathroom-south-wall", 48, "right", 44, "gfci"]],
  );
  assert.match(bathroomReceptacles[0].note, /beyond the fully open bathroom-door leaf/);
});

test("stores the grouped Main open area lights in aligned joist-bay columns", () => {
  const mainAreaLights = pocPlan.lights.filter((item) => item.id.startsWith("main-area-") && item.fixture === "recessed");
  const connectedIds = new Set(pocPlan.circuits.flatMap((item) => item.connections.flatMap((connection) => [connection.fromId, connection.toId])));
  assert.equal(mainAreaLights.length, 17);
  assert.deepEqual(
    mainAreaLights.map((item) => item.at),
    [
      [43.75, 66], [126.25, 66], [203.625, 66], [282.75, 66], [355, 66], [440.25, 66],
      [43.75, 146], [126.25, 146], [203.625, 146], [282.75, 146], [355, 146], [440.25, 146],
      [43.75, 228.75], [126.25, 228.75], [203.625, 228.75], [267, 228.75], [343, 228.75],
    ],
  );
  const shiftedE5 = mainAreaLights.find((item) => item.id === "main-area-east-row-light-05");
  const shiftedM5 = mainAreaLights.find((item) => item.id === "main-area-middle-row-light-05");
  assert.match(shiftedE5.note, /8-inch clear strip/);
  assert.match(shiftedM5.note, /joists-29-30-short-supply-06/);
  assert.equal(mainAreaLights.every((item) => connectedIds.has(item.id)), true);
  assert.equal(mainAreaLights.filter((item) => item.id.includes("soffit-row")).every((item) => /soffit bottom/.test(item.note)), true);
});

test("stores the Main open area dimmer banks and three agreed lighting groups", () => {
  const switchIds = [
    "main-area-cabinet-dimmer",
    "main-area-north-group-dimmer",
    "main-area-center-group-dimmer",
    "main-area-west-group-dimmer",
    "main-area-center-group-entry-three-way-switch",
    "main-area-north-group-entry-three-way-switch",
    "main-area-west-group-entry-three-way-switch",
  ];
  const switches = switchIds.map((id) => pocPlan.switches.find((item) => item.id === id));
  assert.equal(switches.every(Boolean), true);
  assert.deepEqual(
    switches.slice(0, 4).map((item) => [item.wallId, item.offset, item.controlType, item.gangIndex, item.gangCount]),
    [
      ["east-exterior-wall", 30, "dimmer", 1, 4],
      ["east-exterior-wall", 30, "dimmer", 2, 4],
      ["east-exterior-wall", 30, "dimmer", 3, 4],
      ["east-exterior-wall", 30, "dimmer", 4, 4],
    ],
  );
  assert.deepEqual(
    switches.slice(4).map((item) => [item.wallId, item.offset, item.wallSide, item.gangIndex, item.gangCount, item.controlIndex, item.controlCount]),
    [
      ["main-west-divider", 136, "left", 1, 2, undefined, undefined],
      ["main-west-divider", 136, "left", 2, 2, 1, 2],
      ["main-west-divider", 136, "left", 2, 2, 2, 2],
    ],
  );

  const groupFixtureIds = (groupId) => {
    const group = pocPlan.circuits.find((item) => item.id === groupId);
    assert.ok(group);
    const endpointIds = new Set(group.connections.flatMap((connection) => [connection.fromId, connection.toId]));
    return pocPlan.lights.filter((item) => endpointIds.has(item.id)).map((item) => item.id).sort();
  };
  assert.deepEqual(groupFixtureIds("main-area-north-lighting-group"), [
    "main-area-east-row-light-01",
    "main-area-middle-row-light-01",
    "main-area-soffit-row-light-01",
  ]);
  assert.deepEqual(groupFixtureIds("main-area-center-lighting-group"), [
    "main-area-east-row-light-02",
    "main-area-east-row-light-03",
    "main-area-east-row-light-04",
    "main-area-east-row-light-05",
    "main-area-east-row-light-06",
    "main-area-middle-row-light-02",
    "main-area-middle-row-light-03",
    "main-area-middle-row-light-04",
    "main-area-middle-row-light-05",
    "main-area-middle-row-light-06",
  ]);
  assert.deepEqual(groupFixtureIds("main-area-west-lighting-group"), [
    "main-area-soffit-row-light-02",
    "main-area-soffit-row-light-03",
    "main-area-soffit-row-light-04",
    "main-area-soffit-row-light-05",
  ]);
});

test("stores the separately dimmed Main open area under-cabinet light", () => {
  const item = pocPlan.lights.find((lightItem) => lightItem.id === "main-area-cabinet-under-cabinet-light");
  const group = pocPlan.circuits.find((circuitItem) => circuitItem.id === "main-area-cabinet-lighting-group");
  assert.ok(item && group);
  assert.deepEqual([item.fixture, item.at, item.to], ["under-cabinet", [2.5, 10], [122.5, 10]]);
  assert.deepEqual(group.connections, [
    { fromId: "main-area-cabinet-dimmer", toId: "main-area-cabinet-under-cabinet-light" },
  ]);
});

test("reports malformed linear lights and incomplete within-gang switch controls", () => {
  const invalidLightPlan = {
    ...pocPlan,
    lights: pocPlan.lights.map((item) => item.id === "main-area-cabinet-under-cabinet-light" ? { ...item, to: undefined } : item),
  };
  const invalidSwitchPlan = {
    ...pocPlan,
    switches: pocPlan.switches.map((item) => item.id === "main-area-north-group-entry-three-way-switch" ? { ...item, controlCount: undefined } : item),
  };
  assert.ok(validatePlan(invalidLightPlan).some((issue) => issue.code === "invalid-light"));
  assert.ok(validatePlan(invalidSwitchPlan).some((issue) => issue.code === "invalid-switch"));
});

test("stores eight standard Office receptacles around the room perimeter", () => {
  const officeReceptacles = pocPlan.receptacles.filter((item) => item.id.startsWith("office-"));
  assert.equal(officeReceptacles.length, 8);
  assert.equal(officeReceptacles.every((item) => item.receptacleType === "standard"), true);
  assert.deepEqual(
    officeReceptacles.map((item) => [item.wallId, item.offset]),
    [
      ["north-exterior-wall", 201.5],
      ["north-exterior-wall", 95],
      ["office-east-divider", 42],
      ["office-east-divider", 111],
      ["office-south-wall", 48],
      ["office-south-wall", 154],
      ["office-west-jog-wall", 37],
      ["office-closet-divider-wall", 111],
    ],
  );
});

test("stores the Storage lighting group and wall-facing receptacles", () => {
  const switchItem = pocPlan.switches.find((item) => item.id === "storage-entry-light-switch");
  const group = pocPlan.circuits.find((item) => item.id === "storage-lighting-group");
  const storageLights = pocPlan.lights.filter((item) => item.id.startsWith("storage-light-"));
  const storageReceptacles = pocPlan.receptacles.filter((item) => item.id.startsWith("storage-"));
  assert.ok(switchItem && group);
  assert.deepEqual(storageLights.map((item) => item.at), [[507.5, 79], [507.5, 133]]);
  assert.deepEqual([switchItem.wallId, switchItem.offset, switchItem.wallSide], ["storage-north-wall", 114, "left"]);
  assert.deepEqual(group.connections, [
    { fromId: "storage-entry-light-switch", toId: "storage-light-east" },
    { fromId: "storage-light-east", toId: "storage-light-west" },
  ]);
  assert.deepEqual(
    storageReceptacles.map((item) => [item.wallId, item.offset, item.wallSide]),
    [
      ["storage-north-wall", 60, "left"],
      ["south-exterior-wall", 45, undefined],
      ["south-exterior-wall", 115, undefined],
      ["east-exterior-wall", 385.5, undefined],
      ["utility-room-east-wall", 135.5, "left"],
    ],
  );
});

test("stores the Utility Room surface lighting and general-purpose receptacles", () => {
  const switchItem = pocPlan.switches.find((item) => item.id === "utility-room-entry-light-switch");
  const group = pocPlan.circuits.find((item) => item.id === "utility-room-lighting-group");
  const utilityLights = pocPlan.lights.filter((item) => item.id.startsWith("utility-room-light-"));
  const utilityReceptacles = pocPlan.receptacles.filter((item) => item.id.startsWith("utility-room-east-wall-"));
  assert.ok(switchItem && group);
  assert.deepEqual(
    utilityLights.map((item) => [item.at, item.fixture]),
    [[[445, 220], "surface"], [[510, 220], "surface"]],
  );
  assert.deepEqual([switchItem.wallId, switchItem.offset], ["utility-room-east-wall", 48]);
  assert.deepEqual(group.connections, [
    { fromId: "utility-room-entry-light-switch", toId: "utility-room-light-north" },
    { fromId: "utility-room-light-north", toId: "utility-room-light-south" },
  ]);
  assert.deepEqual(
    utilityReceptacles.map((item) => [item.wallId, item.offset, item.receptacleType]),
    [
      ["utility-room-east-wall", 66, "standard"],
      ["utility-room-east-wall", 146, "standard"],
    ],
  );
});

test("stores the Main open area perimeter and counter receptacles", () => {
  const mainReceptacles = pocPlan.receptacles.filter((item) => item.id.startsWith("main-open-area-"));
  const counterReceptacles = mainReceptacles.filter((item) => item.id.startsWith("main-open-area-counter-"));
  assert.equal(mainReceptacles.length, 16);
  assert.equal(counterReceptacles.length, 4);
  assert.equal(counterReceptacles.every((item) => item.heightAboveFloor === 43), true);
  assert.deepEqual(
    mainReceptacles.map((item) => [item.wallId, item.offset, item.wallSide]),
    [
      ["north-exterior-wall", 335, undefined],
      ["north-exterior-wall", 455, undefined],
      ["north-exterior-wall", 530, undefined],
      ["east-exterior-wall", 35, undefined],
      ["east-exterior-wall", 170, undefined],
      ["east-exterior-wall", 245, undefined],
      ["storage-north-wall", 35, undefined],
      ["storage-north-wall", 95, undefined],
      ["main-west-divider", 48, "left"],
      ["main-west-divider", 220, "left"],
      ["main-west-divider", 300, "left"],
      ["east-wall-north-cap", 18, undefined],
      ["east-wall-north-cap", 48, undefined],
      ["east-wall-north-cap", 78, undefined],
      ["east-wall-north-cap", 108, undefined],
      ["utility-room-north-wall-east-extension", 18, "left"],
    ],
  );
});

test("reports a receptacle outside its parent wall", () => {
  const malformed = {
    ...pocPlan,
    receptacles: [{ ...pocPlan.receptacles[0], offset: 999 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-receptacle"));
});

test("reports a receptacle with a negative mounting height", () => {
  const malformed = {
    ...pocPlan,
    receptacles: [{ ...pocPlan.receptacles[0], heightAboveFloor: -1 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-receptacle"));
});

test("stores the conceptual Main open area cabinet run", () => {
  const run = pocPlan.cabinetRuns.find((item) => item.id === "main-open-area-east-wall-cabinet-run");
  assert.ok(run);
  assert.deepEqual(
    [run.wallId, run.offset, run.width, run.baseDepth],
    ["east-wall-north-cap", 2.5, 120, 24],
  );
  assert.deepEqual(
    [run.countertopOffset, run.countertopWidth, run.countertopDepth, run.countertopHeight],
    [0, 125, 25.5, 36],
  );
  assert.deepEqual(
    [run.upperDepth, run.upperBottomAboveFloor, run.upperHeight, run.status, run.confidence],
    [12, 54, 36, "proposed", "approximate"],
  );
});

test("reports a cabinet run outside its parent wall", () => {
  const malformed = {
    ...pocPlan,
    cabinetRuns: [{ ...pocPlan.cabinetRuns[0], width: 126 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-cabinet-run"));
});

test("stores the three proposed Bathroom fixture footprints against mapped drains", () => {
  const tub = pocPlan.bathroomFixtures.find((item) => item.id === "bathroom-north-alcove-tub-shower");
  const toilet = pocPlan.bathroomFixtures.find((item) => item.id === "bathroom-toilet");
  const vanity = pocPlan.bathroomFixtures.find((item) => item.id === "bathroom-west-wall-vanity");
  assert.ok(tub && toilet && vanity);
  assert.deepEqual(
    [tub.fixtureType, tub.center, tub.width, tub.depth, tub.drainId],
    ["tub-shower", [20, 297], 30, 60, "bathroom-tub-shower-drain-rough-in"],
  );
  assert.deepEqual(
    [toilet.fixtureType, toilet.center, toilet.width, toilet.depth, toilet.drainId],
    ["toilet", [53, 311], 20, 28, "bathroom-toilet-drain-rough-in"],
  );
  assert.deepEqual(
    [vanity.fixtureType, vanity.center, vanity.width, vanity.depth, vanity.drainId, vanity.sinkCenter],
    ["vanity", [101.5, 316], 50, 22, "bathroom-sink-drain-rough-in", [94.5, 315]],
  );
  assert.equal(pocPlan.bathroomFixtures.every((item) => item.status === "proposed" && item.confidence === "approximate"), true);
});

test("reports malformed Bathroom fixture footprints and missing drain references", () => {
  const malformed = {
    ...pocPlan,
    bathroomFixtures: [{
      ...pocPlan.bathroomFixtures[0],
      width: 0,
      drainId: "missing-drain",
    }],
  };
  const issues = validatePlan(malformed);
  assert.ok(issues.some((issue) => issue.code === "invalid-bathroom-fixture"));
  assert.ok(issues.some((issue) => issue.code === "missing-plumbing-drain"));
});

test("stores the optional combined-trunk soffit with unknown bottom elevation", () => {
  const item = pocPlan.soffits.find((soffit) => soffit.id === "main-supply-return-soffit");
  assert.ok(item);
  assert.deepEqual(item.polygon, [[0, 186], [375, 186], [375, 267], [0, 267]]);
  assert.equal(item.bottomAboveFloor, undefined);
  assert.equal(item.status, "proposed");
});

test("stores the full-room Bathroom lowered ceiling with unknown bottom elevation", () => {
  const item = pocPlan.soffits.find((soffit) => soffit.id === "bathroom-lowered-ceiling");
  assert.ok(item);
  assert.deepEqual(item.polygon, [[0, 267], [129, 267], [129, 327], [0, 327]]);
  assert.equal(item.bottomAboveFloor, undefined);
  assert.equal(item.status, "proposed");
  assert.match(item.note, /bathroom-north-wall-exhaust-fan-04/);
});

test("reports a soffit without a usable footprint", () => {
  const malformed = { ...pocPlan, soffits: [{ ...pocPlan.soffits[0], polygon: [[0, 0], [1, 1], [2, 2], [3, 3]] }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-soffit"));
});

test("reports duplicate IDs and missing circuit endpoints", () => {
  const malformed = {
    ...pocPlan,
    walls: [...pocPlan.walls, { ...pocPlan.walls[0] }],
    circuits: [{
      id: "bad-circuit",
      kind: "circuit",
      label: "Bad circuit",
      layer: "lighting",
      connections: [{ fromId: "missing-switch", toId: "missing-light" }],
      status: "proposed",
      confidence: "approximate",
    }],
  };
  const codes = validatePlan(malformed).map((issue) => issue.code);
  assert.ok(codes.includes("duplicate-id"));
  assert.ok(codes.includes("missing-circuit-endpoint"));
});

test("reports openings that extend beyond their wall", () => {
  const malformed = { ...pocPlan, windows: [{ ...pocPlan.windows[0], offset: 430 }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "opening-out-of-bounds"));
});

test("reports stair geometry without a usable run", () => {
  const malformed = { ...pocPlan, stairs: [{ ...pocPlan.stairs[0], to: pocPlan.stairs[0].from }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-stairs"));
});

test("reports a stair plan break outside the run", () => {
  const malformed = { ...pocPlan, stairs: [{ ...pocPlan.stairs[0], planBreakOffset: 999 }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-stairs"));
});

test("reports invalid framing assumptions", () => {
  const malformed = { ...pocPlan, framing: { ...pocPlan.framing, studSpacing: 0 } };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-framing-plan"));
});

test("stores both Office water shutoffs with their measured enclosure data", () => {
  const main = pocPlan.waterValves.find((valve) => valve.id === "main-water-valve");
  const sprinkler = pocPlan.waterValves.find((valve) => valve.id === "sprinkler-water-valve");
  assert.ok(main);
  assert.ok(sprinkler);
  assert.deepEqual(
    [main.wallId, main.offset, main.referenceWallId, main.enclosureWidth, main.enclosureBottomAboveFloor, main.enclosureHeight],
    ["office-west-jog-wall", 54, "office-south-wall", 14, 20, 14],
  );
  assert.deepEqual(
    [sprinkler.wallId, sprinkler.offset, sprinkler.referenceWallId, sprinkler.enclosureWidth, sprinkler.enclosureBottomAboveFloor, sprinkler.enclosureHeight],
    ["office-west-wall", 48, "office-bump-south-wall", 14, 20, 24],
  );
});

test("reports water-valve enclosures outside their parent wall", () => {
  const malformed = {
    ...pocPlan,
    waterValves: [{ ...pocPlan.waterValves[0], enclosureWidth: 200 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-water-valve"));
});

test("stores the south-wall electrical and networking cabinets from west-wall measurements", () => {
  const westPanel = pocPlan.wallCabinets.find((item) => item.id === "south-wall-west-electrical-panel");
  const eastPanel = pocPlan.wallCabinets.find((item) => item.id === "south-wall-east-electrical-panel");
  const network = pocPlan.wallCabinets.find((item) => item.id === "south-wall-networking-cabinet");
  assert.ok(westPanel && eastPanel && network);
  assert.deepEqual(
    [westPanel.wallId, westPanel.referenceWallId, westPanel.offset, westPanel.width, westPanel.bottomAboveFloor, westPanel.height],
    ["south-exterior-wall", "storage-west-wall", 12, 15.25, 45, 27],
  );
  assert.deepEqual(
    [eastPanel.offset, eastPanel.width, eastPanel.bottomAboveFloor, eastPanel.height],
    [27.5, 15.25, 45, 27],
  );
  assert.deepEqual(
    [network.cabinetType, network.offset, network.width, network.bottomAboveFloor, network.height],
    ["networking", 42.5, 15.5, 29, 43],
  );
  assert.equal(eastPanel.offset - (westPanel.offset + westPanel.width), 0.25);
  assert.equal(network.offset - (eastPanel.offset + eastPanel.width), -0.25);
  assert.deepEqual(
    [westPanel.bottomAboveFloor + westPanel.height, eastPanel.bottomAboveFloor + eastPanel.height, network.bottomAboveFloor + network.height],
    [72, 72, 72],
  );
  assert.equal(pocPlan.wallCabinets.every((item) => item.confidence === "approximate"), true);
});

test("reports wall cabinets with invalid wall-relative geometry", () => {
  const malformed = {
    ...pocPlan,
    wallCabinets: [{ ...pocPlan.wallCabinets[0], width: 500 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-wall-cabinet"));
});

test("stores the four capped Bathroom drain rough-ins from wall-face measurements", () => {
  const tub = pocPlan.plumbingDrains.find((item) => item.id === "bathroom-tub-shower-drain-rough-in");
  const toilet = pocPlan.plumbingDrains.find((item) => item.id === "bathroom-toilet-drain-rough-in");
  const sink = pocPlan.plumbingDrains.find((item) => item.id === "bathroom-sink-drain-rough-in");
  const unknown = pocPlan.plumbingDrains.find((item) => item.id === "bathroom-unknown-black-drain-rough-in");
  assert.ok(tub && toilet && sink && unknown);
  assert.deepEqual(
    [tub.fixture, tub.at, tub.diameter, tub.heightAboveFloor, tub.capStatus, tub.pipeColor],
    ["tub-shower", [20, 320.25], 2.5, 8, "capped", "white"],
  );
  assert.deepEqual(
    [toilet.fixture, toilet.at, toilet.diameter, toilet.heightAboveFloor],
    ["toilet", [53, 310.5], 3.5, 2.5],
  );
  assert.deepEqual(
    [sink.fixture, sink.at, sink.diameter, sink.heightAboveFloor],
    ["sink", [94.5, 317.25], 2.5, 10.5],
  );
  assert.deepEqual(
    [unknown.fixture, unknown.at, unknown.diameter, unknown.heightAboveFloor, unknown.capStatus, unknown.pipeColor],
    ["unknown", [122, 311], 5.5, 3, "capped", "black"],
  );
  assert.equal(tub.at[0] - 4, 16);
  assert.equal(324.5 - tub.at[1], 4.25);
  assert.equal(126.5 - sink.at[0], 32);
  assert.equal(126.5 - unknown.at[0], 4.5);
});

test("reports plumbing drains without a usable diameter", () => {
  const malformed = {
    ...pocPlan,
    plumbingDrains: [{ ...pocPlan.plumbingDrains[0], diameter: 0 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-plumbing-drain"));
});

test("stores the approximate Furnace Room water heater", () => {
  const heater = pocPlan.plumbingEquipment.find((item) => item.id === "furnace-room-water-heater");
  assert.ok(heater);
  assert.deepEqual(
    [heater.equipmentType, heater.shape, heater.center, heater.diameter, heater.height],
    ["water-heater", "cylinder", [464, 254], 20, 59],
  );
  assert.match(heater.note, /deliberately approximate symbol footprint/);
});

test("stores the measured and conceptual radon pipe route", () => {
  const pipe = pocPlan.radonPipes.find((item) => item.id === "utility-room-floor-to-south-exterior-radon-pipe");
  assert.ok(pipe);
  assert.deepEqual(
    [pipe.from, pipe.waypoints, pipe.to],
    [[467.5, 229.5], [[472.5, 229.5], [472.5, 257.5], [548, 257.5], [552, 261.5]], [560, 269.5]],
  );
  assert.deepEqual(
    [pipe.diameter, pipe.verticalRiseAboveFloor, pipe.diagonalEndAboveFloor, pipe.westRunBottomAboveFloor, pipe.offsetBelowJoists, pipe.exteriorTurn],
    [5, 33, 45, 61, 13, "up"],
  );
  assert.match(pipe.note, /5 inches clear.*7 inches clear/);
  assert.equal(pipe.confidence, "approximate");
});

test("reports malformed radon pipe routes", () => {
  const pipe = pocPlan.radonPipes[0];
  const malformed = {
    ...pocPlan,
    radonPipes: [{ ...pipe, diagonalEndAboveFloor: pipe.verticalRiseAboveFloor }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-radon-pipe"));
});

test("reports plumbing equipment without a usable footprint", () => {
  const malformed = {
    ...pocPlan,
    plumbingEquipment: [{ ...pocPlan.plumbingEquipment[0], diameter: 0 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-plumbing-equipment"));
});

test("stores the surveyed natural-gas route and field references", () => {
  const southRun = pocPlan.gasLines.find((item) => item.id === "gas-main-room-south-run");
  const fireplace = pocPlan.gasLines.find((item) => item.id === "gas-fireplace-branch-joist-bay");
  const waterHeater = pocPlan.gasLines.find((item) => item.id === "gas-water-heater-branch");
  assert.ok(southRun && fireplace && waterHeater);
  assert.deepEqual(
    [southRun.from, southRun.to, southRun.placement, southRun.offsetBelowJoists],
    [[17.875, 236], [335.25, 236], "below-joists", 5],
  );
  assert.deepEqual(
    [fireplace.from, fireplace.to, fireplace.fromEndpoint, fireplace.toEndpoint],
    [[335.25, 236], [335.25, 83], "rise", "rise"],
  );
  assert.match(fireplace.note, /2 inches to its south/);
  assert.deepEqual([waterHeater.from, waterHeater.to, waterHeater.toEndpoint], [[423.5, 232], [465, 232], "appliance"]);
  assert.equal(pocPlan.gasLines.every((item) => item.confidence === "approximate"), true);
});

test("anchors the fireplace gas branch to the measured joist and wall references", () => {
  const fireplace = pocPlan.gasLines.find((item) => item.id === "gas-fireplace-branch-joist-bay");
  const singleJoist = pocPlan.joists.find((item) => item.id === "main-ceiling-joist-27");
  const furnaceWall = pocPlan.walls.find((item) => item.id === "furnace-room-north-wall");
  const eastWall = pocPlan.walls.find((item) => item.id === "east-exterior-wall");
  assert.ok(fireplace && singleJoist && furnaceWall && eastWall);
  const singleJoistNorthEdge = singleJoist.from[0] - singleJoist.width / 2;
  const furnaceWallMainRoomFace = furnaceWall.from[0] - furnaceWall.thickness / 2;
  const eastWallInteriorFace = eastWall.from[1] + eastWall.thickness / 2;
  assert.equal(singleJoistNorthEdge - fireplace.from[0], 2);
  assert.equal(furnaceWallMainRoomFace - fireplace.from[0], 37.25);
  assert.equal(fireplace.to[1] - eastWallInteriorFace, 53);
});

test("keeps the Office closet gas entry approximately 2.5 inches off office-west-wall", () => {
  const service = pocPlan.gasLines.find((item) => item.id === "gas-service-entry-office-closet-to-main-room");
  const officeWestWall = pocPlan.walls.find((item) => item.id === "office-west-wall");
  const joist1 = pocPlan.joists.find((item) => item.id === "main-ceiling-joist-01");
  assert.ok(service && officeWestWall && joist1);
  const officeWestWallInteriorFace = officeWestWall.from[1] - officeWestWall.thickness / 2;
  const joist1SouthFace = joist1.from[0] + joist1.width / 2;
  assert.equal(officeWestWallInteriorFace - service.from[1], 2.5);
  assert.equal(service.to[0] - joist1SouthFace, 2.375);
  assert.deepEqual(service.waypoints, [[17.875, 564.5]]);
  assert.match(service.note, /nearest outside edge/);
  assert.match(service.note, /outside diameter is approximately 1\.75 inches/);
  assert.match(service.note, /modeled centerline is 2\.375 inches/);
  assert.match(service.note, /approximately 1 to 2 inches above the joist bottom/);
  assert.match(service.note, /approximately 8 inches minimum clear/);
  assert.match(service.note, /approximately 9 to 10 inches clear/);
});

test("places the second-floor furnace gas rise southwest of the Furnace Room vent", () => {
  const branch = pocPlan.gasLines.find((item) => item.id === "gas-second-floor-furnace-branch");
  const vent = pocPlan.hvacDucts.find((item) => item.id === "joists-33-34-east-wall-exhaust-10");
  assert.ok(branch && vent && vent.orientation === "horizontal" && vent.shape === "round");
  const ventSouthEdge = vent.from[0] + vent.diameter / 2;
  assert.equal(branch.to[0] - ventSouthEdge, 5);
  assert.equal(vent.from[1] - branch.to[1], 5);
  assert.deepEqual(branch.toEndpoint, "rise");
});

test("reports malformed gas routes", () => {
  const line = pocPlan.gasLines[0];
  const malformed = { ...pocPlan, gasLines: [{ ...line, to: line.waypoints.at(-1) }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-gas-line"));
});

test("stores the approximate furnace footprint from the field survey", () => {
  const furnace = pocPlan.hvacEquipment.find((item) => item.id === "existing-furnace");
  assert.ok(furnace);
  assert.equal(furnace.equipmentType, "furnace");
  assert.deepEqual([furnace.center, furnace.width, furnace.depth, furnace.rotation], [[408.5, 247], 18, 30, 0]);
  assert.equal(furnace.status, "existing");
  assert.equal(furnace.confidence, "approximate");
});

test("reports HVAC equipment without a usable footprint", () => {
  const malformed = {
    ...pocPlan,
    hvacEquipment: [{ ...pocPlan.hvacEquipment[0], width: 0 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-equipment"));
});

test("stores the measured furnace return assembly", () => {
  const riser = pocPlan.hvacDucts.find((item) => item.id === "furnace-return-vertical-trunk");
  const trunk = pocPlan.hvacDucts.find((item) => item.id === "main-return-ceiling-trunk");
  assert.ok(riser && riser.orientation === "vertical");
  assert.ok(trunk && trunk.orientation === "horizontal");
  assert.deepEqual([riser.center, riser.width, riser.depth, riser.bottomAboveFloor, riser.topAboveFloor], [[392.5, 250], 12, 24, 0, 91]);
  assert.deepEqual([trunk.from, trunk.to, trunk.width, trunk.height, trunk.bottomAboveFloor], [[392.5, 250], [84.5, 250], 24, 10, 81]);
  assert.equal(trunk.airflowRole, "return");
});

test("stores the four newly surveyed return runs", () => {
  const furnaceRoom = pocPlan.hvacDucts.find((item) => item.id === "furnace-return-riser-south-wall-run-08");
  const bays23 = pocPlan.hvacJoistReturns.find((item) => item.id === "joists-23-25-west-wall-panned-return");
  const bays19 = pocPlan.hvacJoistReturns.find((item) => item.id === "joists-19-21-west-wall-panned-return");
  const office = pocPlan.hvacJoistReturns.find((item) => item.id === "north-trunk-bathroom-office-panned-return");
  assert.ok(furnaceRoom && furnaceRoom.orientation === "horizontal" && furnaceRoom.shape === "round");
  assert.deepEqual(
    [furnaceRoom.from, furnaceRoom.waypoints, furnaceRoom.to, furnaceRoom.diameter, furnaceRoom.bottomAboveFloor],
    [[392.5, 238], [[392.5, 234]], [474.5, 234], 8, 75],
  );
  assert.ok(bays23 && bays19 && office);
  assert.deepEqual(bays23.joistIds, ["main-ceiling-joist-23", "main-ceiling-joist-24", "main-ceiling-joist-25"]);
  assert.deepEqual(bays19.joistIds, ["main-ceiling-joist-19", "main-ceiling-joist-20", "main-ceiling-joist-21"]);
  assert.deepEqual(office.polygon.slice(-3), [[86.25, 417], [86.25, 327], [86.75, 327]]);
  assert.match(office.note, /approximately 90 inches west/);
});

test("omits the rejected proposed two-bay low-wall return without disturbing the adjacent panned return", () => {
  const item = pocPlan.hvacWallCavityReturns.find((returnItem) => returnItem.id === "main-area-two-bay-low-wall-return");
  const adjacent = pocPlan.hvacJoistReturns.find((returnItem) => returnItem.id === "north-trunk-bathroom-office-panned-return");
  assert.equal(item, undefined);
  assert.ok(adjacent);
});

test("stores the conditional Office ceiling grille on the existing panned return", () => {
  const item = pocPlan.hvacReturnGrilles.find((grille) => grille.id === "office-east-ceiling-return-grille-hvac-review");
  const source = pocPlan.hvacJoistReturns.find((returnItem) => returnItem.id === "north-trunk-bathroom-office-panned-return");
  assert.ok(item && source);
  assert.deepEqual(
    [item.sourceReturnId, item.mounting, item.center, item.width, item.length, item.rotation],
    ["north-trunk-bathroom-office-panned-return", "ceiling", [91, 349], 8, 12, 0],
  );
  assert.equal(item.center[1] - 327, 22);
  assert.equal(item.status, "proposed");
  assert.equal(item.confidence, "approximate");
  assert.match(item.note, /one planned supply register/);
  assert.match(item.note, /framed, sealed boot/);
  assert.match(item.note, /does not exceed its supplied airflow/);
});

test("reports malformed or unanchored return grilles", () => {
  const item = pocPlan.hvacReturnGrilles[0];
  const malformed = {
    ...pocPlan,
    hvacReturnGrilles: [{
      ...item,
      sourceReturnId: "missing-panned-return",
      width: 0,
    }],
  };
  const issues = validatePlan(malformed);
  assert.ok(issues.some((issue) => issue.code === "missing-hvac-source"));
  assert.ok(issues.some((issue) => issue.code === "invalid-hvac-return-grille"));
});

test("reports malformed or unanchored wall-cavity returns", () => {
  const item = hvacWallCavityReturn({
    id: "malformed-wall-cavity-return",
    label: "Malformed wall-cavity return",
    sourceDuctId: "main-return-ceiling-trunk",
    wallId: "main-west-divider",
    cavitySpans: [[48, 64]],
    preservedStudOffsets: [],
    connectionRoute: [[84.5, 250], [82.5, 258]],
    upperBootPolygon: [[48, 258], [84.5, 258], [84.5, 264.5], [48, 264.5]],
    chaseBottomAboveFloor: 0,
    chaseTopAboveFloor: 96,
    grilleSide: "left",
    grilleCenterOffset: 56,
    grilleWidth: 14,
    grilleHeight: 8,
    grilleBottomAboveFloor: 2,
    status: "proposed",
    confidence: "approximate",
  });
  const malformed = {
    ...pocPlan,
    hvacWallCavityReturns: [{
      ...item,
      sourceDuctId: "missing-return-duct",
      cavitySpans: [[80, 40]],
      grilleWidth: 500,
    }],
  };
  const issues = validatePlan(malformed);
  assert.ok(issues.some((issue) => issue.code === "missing-hvac-source"));
  assert.ok(issues.some((issue) => issue.code === "invalid-hvac-wall-cavity-return"));
});

test("omits the rejected conditional sealed low-wall return near joists 29 and 30", () => {
  const item = pocPlan.hvacWallDuctedReturns.find((returnItem) => returnItem.id === "main-area-east-low-wall-return-hvac-review");
  assert.equal(item, undefined);
});

test("reports malformed or unanchored sealed wall returns", () => {
  const item = hvacWallDuctedReturn({
    id: "malformed-wall-ducted-return",
    label: "Malformed wall-ducted return",
    sourceDuctId: "main-return-ceiling-trunk",
    wallId: "furnace-room-north-wall",
    wallSpan: [30, 45],
    connectionRoute: [[362, 238], [372.5, 228.5]],
    upperBootPolygon: [[372.5, 222], [377.5, 222], [377.5, 237], [372.5, 237]],
    chaseBottomAboveFloor: 0,
    chaseTopAboveFloor: 96,
    grilleSide: "left",
    grilleCenterOffset: 37.5,
    grilleWidth: 14,
    grilleHeight: 8,
    grilleBottomAboveFloor: 2,
    status: "proposed",
    confidence: "approximate",
  });
  const malformed = {
    ...pocPlan,
    hvacWallDuctedReturns: [{
      ...item,
      sourceDuctId: "missing-return-duct",
      wallSpan: [20, 10],
      grilleWidth: 500,
    }],
  };
  const issues = validatePlan(malformed);
  assert.ok(issues.some((issue) => issue.code === "missing-hvac-source"));
  assert.ok(issues.some((issue) => issue.code === "invalid-hvac-wall-ducted-return"));
});

test("stores the joist-bay HVAC exhaust route", () => {
  const exhaust = pocPlan.hvacDucts.find((item) => item.id === "joists-33-34-east-wall-exhaust-10");
  assert.ok(exhaust && exhaust.orientation === "horizontal" && exhaust.shape === "round");
  assert.deepEqual(
    [exhaust.from, exhaust.to, exhaust.diameter, exhaust.bottomAboveFloor, exhaust.airflowRole],
    [[424.25, 256.5], [424.25, 22], 10, 91, "exhaust"],
  );
  assert.match(exhaust.note, /main-ceiling-joist-33 and main-ceiling-joist-34/);
  assert.equal(exhaust.confidence, "approximate");
});

test("stores the proposed Bathroom exhaust route beneath the joists", () => {
  const exhaust = pocPlan.hvacDucts.find((item) => item.id === "bathroom-north-wall-exhaust-fan-04");
  assert.ok(exhaust && exhaust.orientation === "horizontal" && exhaust.shape === "round");
  assert.deepEqual(
    [exhaust.from, exhaust.to, exhaust.diameter, exhaust.bottomAboveFloor, exhaust.airflowRole],
    [[53, 311], [-8, 311], 4, 86, "exhaust"],
  );
  assert.equal(-4 - exhaust.to[0], 4);
  assert.match(exhaust.note, /centered above the toilet/);
  assert.match(exhaust.note, /nominal 1-inch planning gap below/);
  assert.match(exhaust.note, /outdoor discharge explicit/);
  assert.equal(exhaust.status, "proposed");
  assert.equal(exhaust.confidence, "approximate");
});

test("stores the approximate refrigerant route through Storage", () => {
  const line = pocPlan.hvacRefrigerantLines.find((item) => item.id === "furnace-to-south-exterior-refrigerant-line");
  assert.ok(line);
  assert.deepEqual(
    [line.from, line.waypoints, line.to],
    [[408.5, 247], [[477, 243], [552, 243]], [560, 243]],
  );
  assert.deepEqual(
    [line.wallPenetrationBelowJoists, line.support, line.exteriorTurn],
    [4, "joist-underside", "up"],
  );
  assert.match(line.note, /24 inches east of the west\/back wall/);
  assert.equal(line.confidence, "approximate");
});

test("reports malformed HVAC refrigerant routes", () => {
  const line = pocPlan.hvacRefrigerantLines[0];
  const malformed = {
    ...pocPlan,
    hvacRefrigerantLines: [{ ...line, to: line.waypoints.at(-1) }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-refrigerant-line"));
});

test("reports malformed or unanchored panned joist returns", () => {
  const panned = pocPlan.hvacJoistReturns[0];
  const malformed = { ...pocPlan, hvacJoistReturns: [{ ...panned, polygon: [[0, 0], [1, 1]], joistIds: ["missing-joist"] }] };
  const issues = validatePlan(malformed);
  assert.ok(issues.some((issue) => issue.code === "invalid-hvac-joist-return"));
  assert.ok(issues.some((issue) => issue.code === "missing-joist"));
});

test("reports invalid HVAC ducts", () => {
  const malformedDuct = {
    ...pocPlan,
    hvacDucts: [{ ...pocPlan.hvacDucts[0], topAboveFloor: 0 }],
  };
  assert.ok(validatePlan(malformedDuct).some((issue) => issue.code === "invalid-hvac-duct"));
});

test("stores the north-bay round supply branch", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "north-bay-upper-floor-supply-08");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[8.625, 209.5], [8.625, 4], 8, 93, "supply"],
  );
  assert.equal(branch.status, "existing");
  assert.equal(branch.confidence, "approximate");
});

test("stores the proposed supply from joists 1–2 to the north-wall east window", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "joists-01-02-north-wall-window-east-supply-06");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[20.25, 209.5], [20.25, 179.5], 6, 93, "supply"],
  );
  assert.equal(branch.status, "proposed");
  assert.equal(branch.confidence, "approximate");
  assert.match(branch.note, /midpoint of north-wall-window-east/);
});

test("stores the proposed supply from joists 1–2 to the north-wall Office window", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "joists-01-02-north-wall-office-window-supply-06");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[20.25, 209.5], [20.25, 435.5], 8, 93, "supply"],
  );
  assert.equal(branch.status, "proposed");
  assert.equal(branch.confidence, "approximate");
  assert.match(branch.note, /gas-service-entry-office-closet-to-main-room/);
  assert.match(branch.note, /approximately 8 inches minimum clear/);
  assert.match(branch.note, /0\.75 inch nominal clearance/);
  assert.match(branch.note, /midpoint of north-wall-office-window/);
});

test("stores the proposed supply from joists 11–12 to the Bathroom south side", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "joists-11-12-bathroom-south-supply-05");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[115.25, 209.5], [115.25, 297], 5, 93, "supply"],
  );
  assert.equal(branch.status, "proposed");
  assert.equal(branch.confidence, "approximate");
  assert.match(branch.note, /crosses above main-return-ceiling-trunk/);
  assert.match(branch.note, /above the Bathroom doorway/);
  assert.match(branch.note, /11\.25 inches north/);
  assert.match(branch.note, /bathroom-ceiling-joist-11/);
});

test("stores the matching round supply branches in joist bays 16–17 and 23–24", () => {
  const branch16 = pocPlan.hvacDucts.find((item) => item.id === "joists-16-17-upper-floor-supply-08");
  const branch23 = pocPlan.hvacDucts.find((item) => item.id === "joists-23-24-upper-floor-supply-08");
  assert.ok(branch16 && branch16.orientation === "horizontal" && branch16.shape === "round");
  assert.ok(branch23 && branch23.orientation === "horizontal" && branch23.shape === "round");
  assert.deepEqual(
    [branch16.from, branch16.to, branch16.diameter, branch16.bottomAboveFloor],
    [[188, 207.5], [188, 30], 8, 93],
  );
  assert.deepEqual(
    [branch23.from, branch23.to, branch23.diameter, branch23.bottomAboveFloor],
    [[298.5, 207.5], [298.5, 30], 8, 93],
  );
});

test("stores the proposed supply from joists 18–19 to the east-wall north window", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "joists-18-19-east-wall-window-north-supply-06");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[219.75, 207.5], [219.75, 38.125], 6, 93, "supply"],
  );
  assert.equal(branch.status, "proposed");
  assert.equal(branch.confidence, "approximate");
  assert.match(branch.note, /8\.125 inches inside the east wall face/);
  assert.match(branch.note, /1\.25 inches south of the midpoint of east-wall-window-north/);
});

test("stores the relocated proposed supply from joists 32–33 to the east-wall south window", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "joists-34-35-east-wall-window-south-supply-06");
  const eastLight = pocPlan.lights.find((item) => item.id === "main-area-east-row-light-06");
  const middleLight = pocPlan.lights.find((item) => item.id === "main-area-middle-row-light-06");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  assert.deepEqual(
    [branch.from, branch.to, branch.diameter, branch.bottomAboveFloor, branch.airflowRole],
    [[408.375, 207.5], [408.375, 38.125], 6, 93, "supply"],
  );
  assert.equal(branch.status, "proposed");
  assert.equal(branch.confidence, "approximate");
  assert.match(branch.note, /main-supply-ceiling-trunk-24/);
  assert.match(branch.note, /joist-32-short-side-takeoff-supply-06/);
  assert.match(branch.note, /accessible balancing damper/);
  assert.deepEqual([eastLight.at, middleLight.at], [[440.25, 66], [440.25, 146]]);
  assert.match(eastLight.note, /34 and main-ceiling-joist-35/);
  assert.match(middleLight.note, /34 and main-ceiling-joist-35/);
});

test("stores the three westbound supply branches from the field survey", () => {
  const closet = pocPlan.hvacDucts.find((item) => item.id === "joists-04-05-office-closet-supply-08");
  const flexible = pocPlan.hvacDucts.find((item) => item.id === "joists-05-06-short-flex-supply-08");
  const officeWall = pocPlan.hvacDucts.find((item) => item.id === "joists-16-17-office-south-wall-supply-06");
  assert.ok(closet && closet.orientation === "horizontal" && closet.shape === "round");
  assert.ok(flexible && flexible.orientation === "horizontal" && flexible.shape === "round");
  assert.ok(officeWall && officeWall.orientation === "horizontal" && officeWall.shape === "round");
  assert.deepEqual(
    [closet.from, closet.waypoints, closet.to, closet.diameter],
    [[55.5, 209.5], [[55.5, 312], [43.75, 312]], [43.75, 567], 8],
  );
  assert.match(closet.label, /upper-floor supply through Office\/Closet/);
  assert.match(closet.note, /does not supply the basement Office or Closet/);
  assert.deepEqual([flexible.from, flexible.to, flexible.diameter], [[66.25, 209.5], [66.25, 235], 8]);
  assert.match(flexible.note, /compressed to fit the approximately 7\.5-inch clear joist bay/);
  assert.deepEqual([officeWall.from, officeWall.to, officeWall.diameter], [[188, 207.5], [188, 525], 6]);
  assert.match(officeWall.label, /upper-floor supply through Office/);
  assert.match(officeWall.note, /does not supply the basement Office/);
});

test("reports a round HVAC duct without a usable diameter", () => {
  const branch = pocPlan.hvacDucts.find((item) => item.id === "north-bay-upper-floor-supply-08");
  assert.ok(branch && branch.orientation === "horizontal" && branch.shape === "round");
  const malformed = { ...pocPlan, hvacDucts: [{ ...branch, diameter: 0 }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-duct"));
});

test("stores the three south-side supply runs from the field survey", () => {
  const short29 = pocPlan.hvacDucts.find((item) => item.id === "joists-29-30-short-supply-06");
  const short32 = pocPlan.hvacDucts.find((item) => item.id === "joist-32-short-side-takeoff-supply-06");
  const under37 = pocPlan.hvacDucts.find((item) => item.id === "supply-elbow-to-joist-37-under-joist-run-08");
  const bay37 = pocPlan.hvacDucts.find((item) => item.id === "joists-37-38-upper-floor-supply-08");
  assert.ok(short29 && short29.orientation === "horizontal" && short29.shape === "round");
  assert.ok(short32 && short32.orientation === "horizontal" && short32.shape === "round");
  assert.ok(under37 && under37.orientation === "horizontal" && under37.shape === "round");
  assert.ok(bay37 && bay37.orientation === "horizontal" && bay37.shape === "round");
  assert.deepEqual(
    [short29.from, short29.to, short29.diameter],
    [[362, 204.5], [362, 126.5], 6],
  );
  assert.deepEqual([short32.from, short32.to, short32.diameter], [[400.625, 195.5], [405, 187.5], 6]);
  assert.deepEqual(
    [under37.from, under37.waypoints, under37.to, under37.diameter],
    [[412.25, 207.5], [[420.25, 199.5]], [487.5, 199.5], 8],
  );
  assert.deepEqual([bay37.from, bay37.to, bay37.diameter], [[487.5, 199.5], [487.5, 30], 8]);
});

test("stores the measured furnace supply trunk through its first reduction", () => {
  const plenum = pocPlan.hvacDucts.find((item) => item.id === "furnace-supply-vertical-plenum");
  const trunk24 = pocPlan.hvacDucts.find((item) => item.id === "main-supply-ceiling-trunk-24");
  const trunk20 = pocPlan.hvacDucts.find((item) => item.id === "main-supply-ceiling-trunk-20");
  const expansion = pocPlan.hvacDuctTransitions.find((item) => item.id === "furnace-supply-east-expansion");
  const reduction = pocPlan.hvacDuctTransitions.find((item) => item.id === "main-supply-reduction-24-to-20");
  assert.ok(plenum && plenum.orientation === "vertical");
  assert.ok(trunk24 && trunk24.orientation === "horizontal");
  assert.ok(trunk20 && trunk20.orientation === "horizontal");
  assert.ok(expansion);
  assert.ok(reduction);
  assert.deepEqual([plenum.center, plenum.width, plenum.depth, plenum.bottomAboveFloor, plenum.topAboveFloor], [[408.5, 251.75], 16.5, 20.5, 58, 91]);
  assert.deepEqual([trunk24.from, trunk24.waypoints, trunk24.to, trunk24.width, trunk24.height], [[412.25, 219.5], [[412.25, 207.5]], [161.5, 207.5], 24, 8]);
  assert.deepEqual([expansion.fromWidth, expansion.toWidth, expansion.fixedEdge], [16.5, 24, "north"]);
  assert.deepEqual([reduction.fromWidth, reduction.toWidth, reduction.fixedEdge], [24, 20, "west"]);
  assert.deepEqual([trunk20.from, trunk20.to, trunk20.width, trunk20.bottomAboveFloor], [[150, 209.5], [4, 209.5], 20, 83]);
});

test("north-wall east window overlaps the 20-inch supply trunk by approximately 4 inches", () => {
  const window = pocPlan.windows.find((item) => item.id === "north-wall-window-east");
  const wall = pocPlan.walls.find((item) => item.id === window?.wallId);
  const trunk = pocPlan.hvacDucts.find((item) => item.id === "main-supply-ceiling-trunk-20");
  assert.ok(window && wall && trunk && trunk.orientation === "horizontal" && trunk.shape === "rectangular");
  const windowWestEdge = wall.from[1] - window.offset;
  const trunkEastEdge = trunk.from[1] - trunk.width / 2;
  assert.equal(window.offset, 367.5);
  assert.equal(windowWestEdge - trunkEastEdge, 4);
});

test("reports an HVAC transition without a usable footprint", () => {
  const malformed = {
    ...pocPlan,
    hvacDuctTransitions: [{
      ...pocPlan.hvacDuctTransitions[0],
      polygon: [[0, 0], [1, 1], [2, 2], [3, 3]],
    }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-transition"));
});
