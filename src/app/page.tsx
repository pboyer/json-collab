"use client";

import React, { useState, useEffect, use } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

// sketch for higharc

// maintain a yjs doc as the main source of truth
// the actual doc read in the app becomes derived state
// when the doc is updated in the reducer, determine what has changed
// undo or redo needs to be re-designed (it is simple don't worry)
// websocket sync runs server side - when state changes, we post it to the server

const initialState = {
  value: 1,
  windows: {
    id1: {
      entityType: "WINDOW",
      id: "id1",
      name: "peter",
    },
    id2: {
      entityType: "WINDOW",
      id: "id2",
      name: "peter",
    },
    id3: {
      entityType: "WINDOW",
      id: "id3",
      name: "peter",
    },
  },
  doors: {
    id1: {
      entityType: "DOOR",
      id: "id1",
      name: "peter",
    },
    id2: {
      entityType: "DOOR",
      id: "id2",
      name: "peter",
    },
    id3: {
      entityType: "DOOR",
      id: "id3",
      name: "peter",
    },
  },
} as const;

type Value = boolean | string | number | object;

function valueToYType<T extends Value>(obj: T): Value | Y.AbstractType<T> {
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

export default function Page() {
  // React state for the shared text
  const [text, setText] = useState("");
  const [users, setUsers] = useState<any[]>([]);

  const [ydoc, setYDoc] = useState<Y.Doc | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);

  useEffect(() => {
    const ydoc = new Y.Doc();

    setYDoc(ydoc);

    const provider = new WebsocketProvider(
      "ws://localhost:1234",
      "my-room-2",
      ydoc
    );

    const awareness = provider.awareness;
    awareness.on("change", () => {
      // Whenever somebody updates their awareness information,
      // we log all awareness information from all users.
      setUsers(Array.from(awareness.getStates().values()));
    });

    awareness.setLocalStateField("user", {
      // Define a print name that should be displayed
      name: `Emmanuelle Charpentier + ${Math.random()}`,
      // Define a color that should be associated to the user:
      color: "#ffb61e", // should be a hex color
    });

    const yText = ydoc.getText("shared-text");
    const yArray = ydoc.getArray<TreeNode>("nodes");
    const root = ydoc.getMap("root");

    if (!root.has("doc")) {
      root.set("doc", valueToYType(initialState));
    }

    root.observe(() => {
      console.log(root.toJSON());
    });

    // Update React state when Yjs content changes
    const updateText = () => setText(yText.toString());

    yText.observe(updateText);

    // Initialize the local state
    setText(yText.toString());

    yArray.observe(() => {
      setNodes(yArray.toArray());
    });

    setNodes(yArray.toArray());

    return () => {
      // Cleanup on unmount
      yText.unobserve(updateText);
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => {
    if (!ydoc) {
      return;
    }

    const value = event.target.value;
    setText(value); // Update local state

    const yText = ydoc.getText("shared-text");
    yText.delete(0, yText.length); // Clear existing content
    yText.insert(0, value); // Insert updated content
  };

  const addNode = (parentId: string | null, sortIndex: number) => {
    if (!ydoc) {
      return;
    }

    const arr = ydoc.getArray<TreeNode>("nodes");
    arr.push([makeTreeNode(parentId, sortIndex)]);
  };

  const deleteNode = (node: TreeNode) => {
    if (!ydoc) {
      return;
    }

    const arr = ydoc.getArray<TreeNode>("nodes");
    const idx = nodes.indexOf(node);
    if (idx !== -1) {
      arr.delete(idx);
    }
  };

  return (
    <div className="p-4 mx-auto">
      <ObjectNodeView
        fieldName="Root"
        value={ydoc?.getMap("root")?.get("doc") as Value | undefined}
      />
      <h1>TreeNodes</h1>
      <AddTreeNodeButton nodes={nodes} addNode={addNode} />
      <TreeChildrenView
        nodes={nodes}
        addNode={addNode}
        deleteNode={deleteNode}
      />
      <h1 className="text-xl font-bold mb-4">Shared Text Editor</h1>
      <textarea
        className="w-full p-2 border rounded"
        rows={6}
        value={text}
        onChange={handleChange}
      />
      <h1>Users</h1>
      <ul style={{ color: "white" }}>
        {users.map((x, i) => {
          return <li key={i}>{JSON.stringify(x)}</li>;
        })}
      </ul>

      <button onClick={() => {}}>Logout</button>
    </div>
  );
}

function TreeChildrenView({
  nodes,
  parentId = null,
  addNode,
  deleteNode,
}: {
  nodes: TreeNode[];
  parentId?: string | null;
  addNode: (parentId: string | null, sortIndex: number) => void;
  deleteNode: (node: TreeNode) => void;
}) {
  const children = nodes.filter((x) => x.parentId === parentId);

  return (
    <ul>
      {children
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map((x) => {
          return (
            <li key={x.id}>
              <ul>
                <li>ID: {JSON.stringify(x.id)}</li>
                <li>Parent ID: {JSON.stringify(x.parentId)}</li>
                <li>
                  <AddTreeNodeButton
                    nodes={nodes}
                    parent={x}
                    addNode={addNode}
                  />
                  <button onClick={() => deleteNode(x)}>Delete</button>
                </li>
                <li>
                  Children:
                  <TreeChildrenView
                    nodes={nodes}
                    parentId={x.id}
                    addNode={addNode}
                    deleteNode={deleteNode}
                  />
                </li>
              </ul>
            </li>
          );
        })}
    </ul>
  );
}

function ObjectNodeHeader({
  // value,
  fieldName,
  children,
}: {
  value: Value | undefined;
  fieldName: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="font-bold">{fieldName}</span>: {children}
    </>
  );
}

function ObjectNodeView({
  fieldName,
  value,
}: {
  fieldName: string;
  value: Value | undefined;
}) {
  const [fieldType, setFieldType] = useState("string");
  const [fieldNameInput, setFieldNameInput] = useState<string>("");
  const [stringInput, setStringInput] = useState<string>("");
  const [numberInput, setNumberInput] = useState<number>(0);
  const [booleanInput, setBooleanInput] = useState<boolean>(false);
  const [showingFieldInput, setShowingFieldInput] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (value === undefined) {
    return null;
  }

  if (!(value instanceof Y.Map) && !(value instanceof Y.Array)) {
    return (
      <ObjectNodeHeader fieldName={fieldName} value={value}>
        {JSON.stringify(value)}
      </ObjectNodeHeader>
    );
  }

  return (
    <ObjectNodeHeader fieldName={fieldName} value={value}>
      {value instanceof Y.Array && (
        <ul>
          {expanded && (
            <li>
              <ul>
                {value.toArray().map((val, i) => {
                  return (
                    <li key={i}>
                      <ObjectNodeView fieldName={i.toString()} value={val} />
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      )}
      {value instanceof Y.Map && (
        <>
          <span
            className={"pl-2 cursor-pointer"}
            onClick={() => setShowingFieldInput(!showingFieldInput)}
          >
            +
          </span>
          {showingFieldInput && (
            <>
              <span className={"pl-2 pr-2"}>Adding field</span>
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
              <input
                type="text"
                placeholder="Field name"
                value={fieldNameInput}
                onChange={(e) => setFieldNameInput(e.target.value)}
              />
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
                  !fieldNameInput ||
                  value.has(fieldNameInput) ||
                  (fieldType === "number" && !numberInput) ||
                  (fieldType === "string" && !stringInput)
                }
                onClick={() => {
                  switch (fieldType) {
                    case "boolean": {
                      value.set(fieldNameInput, booleanInput);
                      setBooleanInput(false);
                      break;
                    }
                    case "number": {
                      value.set(fieldNameInput, Number(numberInput));
                      setNumberInput(0);
                      break;
                    }
                    case "string": {
                      value.set(fieldNameInput, stringInput);
                      setStringInput("");
                      break;
                    }
                    case "object": {
                      value.set(fieldNameInput, new Y.Map());
                      break;
                    }
                    case "array": {
                      value.set(fieldNameInput, new Y.Array());
                      break;
                    }
                  }
                  setShowingFieldInput(false);
                }}
              >
                Add
              </button>
            </>
          )}
          <>
            {expanded && (
              <ul>
                {Array.from(value.keys()).map((key) => {
                  return (
                    <li key={key}>
                      <ObjectNodeView fieldName={key} value={value.get(key)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        </>
      )}
    </ObjectNodeHeader>
  );
}

function AddTreeNodeButton({
  addNode,
  parent,
  nodes,
}: {
  addNode: (parentId: string | null, sortIndex: number) => void;
  nodes: TreeNode[];
  parent?: TreeNode;
}) {
  return (
    <button
      onClick={() =>
        addNode(
          parent?.id ?? null,
          Math.max(
            ...nodes
              .filter((x) => x.parentId === parent?.id)
              .map((x) => x.sortIndex)
          )
        )
      }
    >
      Add child
    </button>
  );
}

function makeId(len: number = 12) {
  return String.fromCharCode(
    ...new Array(len).fill(0).map(() => (97 + Math.random() * 26) | 0)
  );
}

interface TreeNode {
  id: string;
  parentId: string | null;
  sortIndex: number;
}

function makeTreeNode(parentId: string | null, sortIndex: number): TreeNode {
  return {
    id: makeId(),
    parentId,
    sortIndex,
  };
}
