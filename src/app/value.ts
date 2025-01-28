"use client";
import * as Y from "yjs";

export type Value = boolean | string | number | object;

export function valueToYType<T extends Value>(
  obj: T
): Value | Y.AbstractType<T> {
  const t = typeof obj;

  if (
    t === "string" ||
    t === "boolean" ||
    t === "number" ||
    t === "undefined" ||
    obj === null
  ) {
    return obj;
  }

  if (ArrayBuffer.isView(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const arr = new Y.Array();
    arr.push(obj.map((val) => valueToYType(val)));
    return arr;
  }

  if (t === "object") {
    const map = new Y.Map();

    for (const key of Object.keys(obj)) {
      const res = valueToYType((obj as { [key: string]: Value })[key]);
      map.set(key, res);
    }

    return map;
  }

  throw new TypeError("unknown type" + typeof obj);
}
