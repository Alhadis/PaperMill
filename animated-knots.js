/**
 * @fileoverview
 *    Save a knot entry on [Animated Knots]{@link https://www.animatedknots.com/}.
 *    Currently executed manually from the devtools console after loading a page.
 */
"use strict";

const $  = document.querySelector   .bind(document);
const $$ = document.querySelectorAll.bind(document);


// “Export” function definitions as globals, as ESM exports make
// copy+pasting code to the browser console much more cumbersome.
Object.assign(window, {
	isVisible,
	isYouTubeDomain,
	saveKnot,
});


// Ad-related crap that just gets in the way
for(const el of $$(".templatera_shortcode"))
	el.remove();

console.log(saveKnot());



/**
 * Return true if an element has a non-empty bounding box.
 * @param {Element} el
 * @return {Boolean}
 * @public
 */
function isVisible(el){
	const box = el.getBoundingClientRect();
	return box.width + box.height > 0;
}


/**
 * Return true if a hostname matches YouTube's main domain,
 * or a restricted-access, embedding-only domain-name.
 *
 * @example isYouTubeDomain("youtube.com")     === true;
 * @example isYouTubeDomain("www.youtube.com") === true;
 * @param {String} domain
 * @return {Boolean}
 * @public
 */
function isYouTubeDomain(domain){
	domain = domain.toLowerCase().replace(/^\.|\.$/g, "");
	const ytDomains = "youtube youtubeeducation youtube-nocookie youtubekids";
	for(const name of ytDomains.split(" ")){
		if(domain === `${name}.com` || domain === `www.${name}.com`)
			return true;
		if(domain.endsWith(`.${name}.com`))
			return domain.length > name.length + 5;
	}
	return false;
}


/**
 * Save the content of an [Animated Knots]{@link https://www.animatedknots.com/} page.
 * @return {Object}
 */
function saveKnot(){
	const knot = {
		name:         $("h1:not(:empty)").textContent.trim(),
		summary:      $("h2:not(:empty).knot-description").textContent.trim(),
		postID:       parseInt(new URL($('link[rel="shortlink"]').href).searchParams.get("p"), 10),
		modified:     null,
		published:    null,
		tyingOptions: new Map(),
		categories:   new Set(),
		aliases:      new Set(),
		body:         null,
		videos:       [],
		steps:        [],
	};

	// WordPress page timestamps
	const ld = JSON.parse($('script[type="application/ld+json"]').textContent);
	for(const scheme of ld["@graph"])
		if("WebPage" === scheme["@type"]){
			knot.modified  = new Date(scheme.dateModified);
			knot.published = new Date(scheme.datePublished);
			break;
		}

	let fieldBox;
	for(const h6 of $$(".wpb_raw_code h6")){
		const text = h6.textContent.toLowerCase();
		if(text.startsWith(knot.name.toLowerCase()) && text.endsWith(" details")){
			fieldBox = h6.parentElement;
			break;
		}
	}
	
	// Blue-coloured named-field box containing (possibly empty) “key: value”-style fields
	if(fieldBox){
		
		// Categories/type-lists this knot has been added to
		const foundIn = fieldBox.querySelector(":scope > h6 + p");
		if(foundIn && isVisible(foundIn)){
			const label = foundIn.querySelector(":scope > strong:only-child > span:first-child");
			const links = label.nextElementSibling;
			if("Found in:" === label.textContent.trim() && links?.matches("span:last-child:has(a[href])"))
				for(const el of links.querySelectorAll("a[href]"))
					knot.categories.add(el.textContent.trim());
		}
		
		// Aliases and alternate names
		const altName = fieldBox.querySelector(":scope > .alternate-name-text-field");
		if(altName && isVisible(altName)){
			const label = altName.querySelector(":scope > strong:first-child:only-child");
			const aliasList = label.nextSibling;
			if("Also known as:" === label.textContent.trim() && Node.TEXT_NODE === aliasList.nodeType)
				for(const alias of aliasList.textContent.split(","))
					knot.aliases.add(alias.trim());
		}
		
		// Typing options
		const tyingOpts = fieldBox.querySelector(":scope > h6 ~ .tying-option-links");
		if(tyingOpts && isVisible(tyingOpts)){
			const label = tyingOpts.querySelector(":scope > strong:only-child > span:first-child");
			const opts = label.nextElementSibling;
			if("Tying options:" === label.textContent.trim() && opts?.matches("span:last-child:has(a[href])"))
				for(const el of opts.querySelectorAll("a[href]"))
					knot.tyingOptions.set(el.textContent.trim(), el.href);
		}
		
		knot.aliases.delete("");
		knot.categories.delete("");
		knot.tyingOptions.delete("");
	}
	
	// Freeform HTML markup containing most of the knot's detailed documentation
	const details = $(".wpb_wrapper > .details-knot");
	if(details && isVisible(details)){
		knot.body = details.cloneNode(true);
		const glossary = new Map();
		const killList = new Set();
		for(const el of knot.body.childNodes){
			switch(el.nodeType){
				case Node.COMMENT_NODE:
					killList.add(el);
					continue;
				case Node.TEXT_NODE:
					// Shouldn't happen, but better safe than sorry
					if(el.textContent.trim())
						throw new DOMError("Non-empty text node not wrapped by HTML element");
					killList.add(el);
					continue;
			}
			
			// This formatting idiom is better expressed as a “<dt>/<dd>” pair
			if(el.matches("p > strong.para:first-child")){
				const label = el.firstElementChild;
				const text  = label.textContent.trim().replace(/\s*:$/, "");
				glossary.set(text, el); // We'll massage the markup later
				if(parseInt(label.style.marginLeft) > 0){
					label.classList.add("offset");
					label.removeAttribute("style");
				}
			}
		}
		for(const node of killList)
			node.remove();
		killList.clear();
	}
	
	// Tutorial video
	const videoContainer = document.getElementById("video");
	if(videoContainer && isVisible(videoContainer)){
		const iframe = videoContainer.querySelector("iframe");
		if(iframe && iframe.src){
			const url  = new URL(iframe.src);
			const time = url.searchParams.get("t");
			const path = url.pathname.replace(/^\//, "");
			let domain = url.hostname, ytID;
			
			// Embedded YouTube video URL, or an ordinary watch link
			if(isYouTubeDomain(domain))
				ytID = "watch" === path
					? url.searchParams.get("v")
					: path.startsWith("embed/") && path.length > 6
						? path.slice(6)
						: null;

			// Video shortlink
			else if("youtu.be" === domain && path){
				domain = "www.youtube.com";
				ytID = path;
			}
			
			if(ytID){
				const videoURL = new URL(`https://${domain}/watch`);
				videoURL.searchParams.set("v", ytID);
				time && videoURL.searchParams.set("t", time);
				knot.videos.push(videoURL);
			}
		}
	}

	const frag = document.createElement("div");
	const purify = html => html
		.replace(/<div(?=\s|>)[^>]*>/gi, "<div>")
		.replace(/<span(?=\s|>)[^>]*>/gi, "<span>")
		.replace(/<\/?(?!span|div)\\w.*>/gi, "")
		.replace(/<script(?=\s|>)[^>]*>.+?<\/script>/gi, "");

	// TODO: Fix repetition of text from earlier slides.
	reset();
	for(let i = 1; i <= MaxImages; ++i){
		frag.innerHTML = purify(ScrollingArray[i]);
		const {textContent: text} = frag.children[0].children[0];
		const step = {step: i, image: TheKnot[i].src, text};
		knot.steps.push(step);
		
		// Store button label if it's anything other than the step-number
		frag.innerHTML = purify(ButtonInsert[i]);
		const label = frag.children[0].textContent.trim();
		if(label !== step.step.toString())
			step.label = label;
	}
	return knot;
}
