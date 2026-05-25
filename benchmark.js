const { JSDOM } = require("jsdom");
const { window } = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
const { document, MutationObserver } = window;

const target = document.createElement('div');
document.body.appendChild(target);

// Create a large NodeList
for (let i = 0; i < 10000; i++) {
  target.appendChild(document.createElement('div'));
}

const addedNodes = target.childNodes; // This is a NodeList

// Benchmark Array.from
console.time("Array.from");
for(let j=0; j<1000; j++) {
    for (const added of Array.from(addedNodes)) {
      const a = added.nodeType;
    }
}
console.timeEnd("Array.from");

// Benchmark for...of directly
console.time("for...of");
for(let j=0; j<1000; j++) {
    for (const added of addedNodes) {
      const a = added.nodeType;
    }
}
console.timeEnd("for...of");

// Benchmark for loop
console.time("for loop");
for(let j=0; j<1000; j++) {
    for (let i = 0; i < addedNodes.length; i++) {
        const added = addedNodes[i];
        const a = added.nodeType;
    }
}
console.timeEnd("for loop");
