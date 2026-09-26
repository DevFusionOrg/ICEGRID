import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocationEventId } from "../src/lib/locationEventId.ts";

test("creates an RFC 4122 v4 event ID using getRandomValues only", () => {
  const randomSource = {
    getRandomValues(bytes: Uint8Array) {
      bytes.set([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x06, 0x77, 0x08, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
      return bytes;
    },
  };

  assert.equal(createLocationEventId(randomSource), "00112233-4455-4677-8899-aabbccddeeff");
  assert.match(createLocationEventId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});