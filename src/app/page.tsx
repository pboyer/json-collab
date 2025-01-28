"use client";

import React, { useState, useEffect, useCallback, ReactNode } from "react";
import * as Y from "yjs";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { Value } from "./value";
// import { WebsocketProvider } from "y-websocket";

// sketch for higharc

// maintain a yjs doc as the main source of truth
// the actual doc read in the app becomes derived state
// when the doc is updated in the reducer, determine what has changed
// undo or redo needs to be re-designed (it is simple don't worry)
// websocket sync runs server side - when state changes, we post it to the server

const client = createClient({
  publicApiKey:
    "pk_dev_SXt-Mf0puijXLUdysP0JnBAF8ffn53LrN0cgLAvsvWpbE59AawQl0IiI9X61DcmC",
});

interface User {
  name: string;
  color: string;
}

export default function Page() {
  const [users, setUsers] = useState<User[]>([]);
  const [ydoc, setYDoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    const { room, leave } = client.enterRoom("your-room-id");

    const ydoc = new Y.Doc();

    setYDoc(ydoc);

    // const provider = new WebsocketProvider(
    //   "ws://localhost:1234",
    //   "my-room-4",
    //   ydoc
    // );

    const provider = new LiveblocksYjsProvider(room, ydoc);

    const awareness = provider.awareness;

    awareness.setLocalStateField("user", {
      // Define a print name that should be displayed
      name: `User${makeRandomId()}`,
      // Define a color that should be associated to the user:
      color: makeRandomHex(), // should be a hex color
    });

    const cb = () =>
      setUsers(
        Array.from(awareness.getStates().values()).map(
          (x) => (x as { user: User }).user
        ) as User[]
      );
    awareness.on("change", cb);
    cb();

    return () => {
      awareness.destroy();
      provider.destroy();
      ydoc.destroy();
      leave();
    };
  }, []);

  return (
    <div className="p-4 mx-auto">
      {ydoc && (
        <>
          <h1>Collaborative JSON Editor</h1>
          <div className="mt-4 mb-4">
            <ObjectNodeView fieldName="Root" value={ydoc.getMap("root")} />
          </div>
        </>
      )}

      <hr />
      <div className="mt-4 mb-4">
        <h1>Users</h1>
        <ul style={{ color: "white" }}>
          {users.map((x, i) => {
            return (
              <li key={i} style={{ background: x.color, color: "white" }}>
                {x.name}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ObjectNodeHeader({
  value,
  fieldName,
  controls,
  children,
  onDelete,
  append = true,
}: {
  value: Value | undefined;
  fieldName: string | number;
  controls?: React.ReactNode;
  children: React.ReactNode;
  onDelete: () => void;
  append?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      <div
        style={{
          display: "inline-block",
          paddingRight: "8px",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {value instanceof Y.Map || value instanceof Y.Array ? (
          <UTFButton onClick={() => setExpanded(!expanded)}>
            <>
              {!expanded && <>&#9654;</>}
              {expanded && <>&#x25BC;</>}
            </>
          </UTFButton>
        ) : (
          <UTFButton>
            <span style={{ opacity: 0 }}>&#9654;</span>
          </UTFButton>
        )}
        <span className="font-bold">{fieldName}</span>
        {value instanceof Y.Map && " (Object)"}
        {value instanceof Y.Array && " (Array)"}:
        {expanded && !append && children}
        {hovered && expanded && (
          <>
            {controls}
            <span className="pl-2 pr-2 cursor-pointer" onClick={onDelete}>
              &#215;
            </span>
          </>
        )}
      </div>
      {expanded && append && children}
    </>
  );
}

function IndentBox({ children }: { children: ReactNode }) {
  return <div className="pl-2">{children}</div>;
}

function ObjectNodeView({
  fieldName,
  value,
  parentValue,
}: {
  fieldName: string | number;
  value: Value | undefined;
  parentValue?: Y.Map<unknown> | Y.Array<unknown>;
}) {
  const [showingFieldInput, setShowingFieldInput] = useState(false);

  const onDelete = useCallback(() => {
    if (parentValue instanceof Y.Map) {
      parentValue.delete(String(fieldName));
    } else if (parentValue instanceof Y.Array) {
      parentValue.delete(Number(fieldName));
    }
  }, [fieldName, parentValue]);

  const [entries, setEntries] = useState<[string | number, Value][]>([]);

  useEffect(() => {
    if (value instanceof Y.Map) {
      const cb = () =>
        setEntries(
          Array.from(value.keys()).map((key) => [key, value.get(key)])
        );
      cb();
      value.observe(cb);

      return () => {
        value.unobserve(cb);
      };
    }

    if (value instanceof Y.Array) {
      const cb = () => setEntries(value.toArray().map((x, i) => [i, x]));
      cb();
      value.observe(cb);

      return () => {
        value.unobserve(cb);
      };
    }
  }, [value]);

  if (!(value instanceof Y.Map) && !(value instanceof Y.Array)) {
    return (
      <IndentBox>
        <ObjectNodeHeader
          fieldName={fieldName}
          value={value}
          onDelete={onDelete}
          append={false}
        >
          {JSON.stringify(value)}
        </ObjectNodeHeader>
      </IndentBox>
    );
  }

  return (
    <IndentBox>
      {(value instanceof Y.Map || value instanceof Y.Array) && (
        <ObjectNodeHeader
          fieldName={fieldName}
          value={value}
          onDelete={onDelete}
          controls={
            !showingFieldInput && (
              <UTFButton
                onClick={() => setShowingFieldInput(!showingFieldInput)}
              >
                +
              </UTFButton>
            )
          }
        >
          {showingFieldInput && (
            <AddFieldControls
              parentValue={value}
              onClose={() => setShowingFieldInput(false)}
            />
          )}
          <IndentBox>
            <IndentBox>
              {entries.map(([key, val]) => {
                return (
                  <ObjectNodeView
                    key={key}
                    fieldName={key}
                    value={val}
                    parentValue={value}
                  />
                );
              })}
            </IndentBox>
          </IndentBox>
        </ObjectNodeHeader>
      )}
    </IndentBox>
  );
}

function UTFButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <span onClick={onClick} className="pl-2 pr-2 cursor-pointer text-lg">
      {children}
    </span>
  );
}

function AddFieldControls({
  parentValue,
  onClose,
}: {
  parentValue: Y.Map<unknown> | Y.Array<unknown>;
  onClose: () => void;
}) {
  const [fieldType, setFieldType] = useState("string");
  const [fieldNameInput, setFieldNameInput] = useState<string>("");
  const [stringInput, setStringInput] = useState<string>("");
  const [numberInput, setNumberInput] = useState<number>(0);
  const [booleanInput, setBooleanInput] = useState<boolean>(false);

  return (
    <div style={{ display: "inline-block" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 12,
          padding: 2,
          borderRadius: 3,
          background: "rgba(255, 255, 255,.1)",
        }}
      >
        <span className={"pl-2 pr-2"}>Add Property</span>
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value)}
        >
          <option>string</option>
          <option>number</option>
          <option>boolean</option>
          <option>object</option>
          <option>array</option>
        </select>
        {parentValue instanceof Y.Map && (
          <input
            type="text"
            placeholder="Field name"
            value={fieldNameInput}
            onChange={(e) => setFieldNameInput(e.target.value)}
          />
        )}
        {fieldType === "string" ? (
          <input
            type="text"
            value={stringInput}
            placeholder="Text value"
            onChange={(e) => setStringInput(e.target.value)}
          />
        ) : null}
        {fieldType === "number" ? (
          <input
            type="number"
            value={numberInput}
            placeholder="Number value"
            onChange={(e) => setNumberInput(Number(e.target.value))}
          />
        ) : null}
        {fieldType === "boolean" ? (
          <select
            value={booleanInput ? "true" : "false"}
            onChange={(e) => setBooleanInput(Boolean(e.target.value))}
          >
            <option>true</option>
            <option>false</option>
          </select>
        ) : null}
        <button
          disabled={
            (parentValue instanceof Y.Map &&
              (!fieldNameInput || parentValue.has(fieldNameInput))) ||
            (fieldType === "string" && !stringInput)
          }
          onClick={() => {
            let value: Value;

            switch (fieldType) {
              case "boolean": {
                value = booleanInput;
                setBooleanInput(false);
                break;
              }
              case "number": {
                value = Number(numberInput);
                setNumberInput(0);
                break;
              }
              case "string": {
                value = stringInput;
                setStringInput("");
                break;
              }
              case "object": {
                value = new Y.Map();
                break;
              }
              case "array": {
                value = new Y.Array();
                break;
              }
              default: {
                throw new Error("unknown type");
              }
            }

            if (parentValue instanceof Y.Map) {
              parentValue.set(fieldNameInput, value);
            } else if (parentValue instanceof Y.Array) {
              parentValue.push([value]);
            }
          }}
        >
          Add
        </button>
        <button onClick={() => onClose()}>Cancel</button>
      </div>
    </div>
  );
}

function makeRandomId(len: number = 12) {
  return String.fromCharCode(
    ...new Array(len).fill(0).map(() => (97 + Math.random() * 26) | 0)
  );
}

function makeRandomHex() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}
