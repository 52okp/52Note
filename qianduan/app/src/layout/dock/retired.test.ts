import * as assert from "node:assert/strict";
import test from "node:test";
import {removeRetiredDockEntries} from "./retired";

test("retired inbox entries are removed without changing other dock configuration", () => {
    const file = {type: "file", show: true};
    const plugin = {type: "custom-plugin", show: false};
    const agent = {type: "agentChat", show: true};
    const entries = [file, {type: "inbox", show: true}, {type: "inbox", show: false}, plugin, agent];
    removeRetiredDockEntries(entries);
    assert.deepEqual(entries, [file, plugin, agent]);
    assert.equal(entries[0], file);
    assert.equal(entries[1], plugin);
    removeRetiredDockEntries(entries);
    assert.deepEqual(entries, [file, plugin, agent]);
});
