const $  = document.querySelector   .bind(document);
const $$ = document.querySelectorAll.bind(document);
const isList = x => Array.isArray(x)
	|| x instanceof NodeList
	|| x instanceof HTMLCollection
	|| x instanceof HTMLAllCollection;
const select = x => x instanceof Element ? [x] : isList(x) ? x : $$(x);
const purge = selector => $$(selector).forEach(el => el.remove());
purge.class = (name, selector = null) => {
	if(name.startsWith("."))
		name = name.slice(1);
	selector ??= "." + name;
	for(const el of $$(selector)){
		el.classList.remove(name);
		if(!el.classList.length)
			el.removeAttribute("class");
	}
};
const unwrap = selector => {
	for(const el of select(selector)){
		if(!el.parentNode) continue;
		el.after(...el.childNodes);
		el.remove();
	}
};
/**
 * Trim trailing blank lines from a text-node.
 * @param {CharacterData} node - Textual node, modified in-place
 * @param {Number} [maxLines=Infinity] - Maximum number of empty lines to trim
 * @throws {TypeError}
 * @return {void}
 */
const trimEnd = (node, maxLines = Infinity) => {
	if(!(node instanceof CharacterData))
		throw new TypeError("Cannot trim non-text node");
	let trimmed = 0;
	while(trimmed++ < maxLines){
		const space = node.data.match(/\n[ \t]*$/);
		if(!space) break;
		if(!space.offset)
			node.remove();
		else{
			const {length} = space[0];
			node.deleteData(node.length - length, length);
		}
	}
};
const semantify = (selector, tagName) => {
	for(const el of $$(selector)){
		const tag = document.createElement(tagName);
		el.parentNode.insertBefore(tag, el);
		while(el.firstChild)
			tag.appendChild(el.firstChild);
		el.remove();
	}
};
semantify.codeBlock = (table, delineate = false) => {
	const lines = semantify.codeBlock.lines(table);
	const pre = document.createElement("pre");
	pre.lang = "applescript";
	const numLines = lines.length;
	for(let i = 0; i < numLines; ++i){
		const line = lines[i];
		let last = line.lastChild;
		if("SPAN" === last?.tagName && !last.textContent){
			last.remove();
			line.normalize();
			last = line.lastChild;
		}
		
		if(Node.TEXT_NODE === last.nodeType)
			trimEnd(last, 1);
		
		if(delineate){
			const code = document.createElement("code");
			code.dataset.line = i + 1;
			for(const node of line.childNodes)
				code.appendChild(node);
			pre.appendChild(code);
		}
		else for(const node of line.childNodes)
			pre.appendChild(node);
		if(i < numLines - 1)
			pre.appendChild(document.createTextNode("\n"));
	}
	delineate || pre.normalize();
	const parent = table.parentElement;
	parent.before(pre);
	parent.remove();
	return pre;
};
/**
 * Unwrangle lines of text within a code-block table.
 * @param {HTMLTableElement} table
 * @return {HTMLPreElement[]}
 */
semantify.codeBlock.lines = table => {
	const lines = [];
	if(table.tHead || table.tFoot)
		throw new TypeError("Unexpected header");
	for(const {rows} of table.tBodies)
	for(const row of rows){
		const {childElementCount: length, cells} = row;
		const err = `Row ${row.rowIndex + 1} `;
		if(length > 1)
			throw new TypeError(err + "has too many cells");
		const [td] = cells;
		if("row" !== td.scope)
			throw new TypeError(err + 'cell missing scope="row"');
		switch(td.childElementCount){
			default: throw new TypeError(err + "unusual cell content");
			case 0:  throw new TypeError(err + "empty cell");
			case 1:  break;
		}
		const el = td.firstElementChild;
		if("PRE" !== el.tagName)
			throw new TypeError(err + "cell contains non-<pre> tag");
		lines.push(el);
	}
	return lines;
};
/**
 * Reduce page's footer to meaningful content.
 * @param {String} selector
 * @return {HTMLElement}
 */
semantify.footer = selector => {
	let legal = "", lastUpdated;
	const copyright = $(selector);
	const nodes = [...copyright.childNodes];
	if(!nodes.length)
		throw new TypeError("No text-nodes in footer");
	for(const node of nodes){
		if(Node.TEXT_NODE === node.nodeType){
			if(/\(c\)|©|^\s*Copyright\b/i.test(node.data))
				legal = (legal + "\n" + node.data).trim();
			let match = node.data.match(/^\s*\|\s*/);
			if(!match) continue;
			const {length} = match[0];
			length === node.length
				? node.remove()
				: node.deleteData(0, length);
			match = node.data.match(/^\s*Updated\s*:/i);
			if(match){
				if(null != lastUpdated)
					throw new TypeError("Ambiguous footer timestamp");
				const date = node.data.slice(match[0].length).trim();
				lastUpdated = new Date(date);
				if(Number.isNaN(+lastUpdated))
					throw new TypeError("Invalid timestamp: " + date);
				lastUpdated.sourceText = date;
			}
		}
	}
	const footer = document.createElement("footer");
	if(legal){
		const el = document.createElement("small");
		const lines = legal.split("\n");
		for(let i = 0; i < lines.length; ++i){
			i > 0 && el.appendChild(document.createElement("br"));
			el.appendChild(document.createTextNode(lines[i]));
		}
		el.normalize();
		el.classList.add("legal");
		footer.append(el);
	}
	if(lastUpdated){
		const el = document.createElement("time");
		const d8 = lastUpdated?.sourceText ?? lastUpdated.toISOString();
		el.dateTime = d8;
		el.textContent = `Updated: ${d8}`;
		if(footer.childElementCount)
			footer.appendChild(document.createTextNode(" "));
		footer.append(el);
	}
	copyright.after(footer);
	copyright.remove();
	return footer;
};

// Fix page footer
if($("#contents > footer"))
	throw new TypeError("Unexpected <footer> element");
unwrap(".copyright > div[align]:only-child");
unwrap(".copyright p.content_text:only-child");
purge(".copyright a[href]:not(:empty)");
const footer = semantify.footer(".copyright");

purge(`
	x-script,
	#_omniture_top,
	#adcHeader,
	#header:has(#title[role=banner]),
	#tocContainer,
	#pageNavigationLinks_top,
	#pageNavigationLinks_bottom,
	#contents > a[id=top],
	#contents > a[id=INDEX],
	#pediaWindow,
	aside > div:empty,
	aside > p:empty,
	p > div:empty:is(:last-child, :nth-last)
	.copyright > :is(hr, br)
`);
purge.class(".jump");
purge.class(".clear");
purge.class(".ul", "ul");
purge.class(".li", "li");
purge.class(".content_text");
purge.class(".tablecaption", "caption");
semantify("em.variableText", "var");
semantify("em.newTerm", "dfn");
unwrap("dd > p:only-child");
unwrap(".api.specialConsiderations:has(> h5):has(> h5 + *)");

for(const dl of $$("dl")){
	const sel = ":scope > dt > em:only-child";
	const dt = [...dl.children].filter(el => "DT" === el.tagName);
	if(dt.every(({children}) =>
		1 === children.length && "EM" === children[0].tagName
	)) for(const el of dl.querySelectorAll(sel)) unwrap(el);
	else if(dl.querySelector(sel))
		throw new TypeError("Ambiguously-formatted description list");
}

for(const dl of $$("h5 + dl")){
	if(dl.title || dl.ariaLabel || dl.ariaLabelledByElements?.length) continue;
	dl.setAttribute("aria-label", dl.previousElementSibling.textContent);
}

for(const el of $$(".warningbox > aside:only-child")){
	const parent = el.parentElement;
	parent.before(el);
	parent.remove();
	el.classList.add("warning");
}

for(const table of $$(".codesample > table:only-child")){
	try{
		semantify.codeBlock(table);
	}
	catch(error){
		console.error("Skipping table: " + error.message);
		continue;
	}
}

// Group content sections
const refHeads = [...$$("#contents > a[name]:empty + .content_ref_head")];
if(refHeads.length && !$("#contents h2")){
	const children = [...$("#contents").children];
	const indexes  = new Map(refHeads.map(el => [el, children.indexOf(el)]));
	const sections = new Map(refHeads.map(el => [el, []]));
	indexes.set(footer, children.indexOf(footer));
	for(let i = 0; i < refHeads.length; ++i){
		const head = refHeads[i];
		const from = indexes.get(head);
		const to   = indexes.get(refHeads[i + 1] ?? footer);
		if(-1 === from || -1 === to)
			throw new Error("Shouldn't happen");
		sections.get(head).push(...children.slice(from - 1, to - !!refHeads[i + 1]));
	}
	for(const [head, nodes] of sections){
		const el = document.createElement("section");
		const h2 = document.createElement("h2");
		h2.textContent = head.textContent;
		for(const node of nodes)
			el.appendChild(node === head ? h2 : node);
		head.parentElement.replaceChild(el, head);
	}
}
