import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CinematicMedia from "../../src/components/home/sections/hero/CinematicMedia";
import NavBar from "../../src/components/home/NavBar";
import { isSafeLocalMediaPath } from "../../src/components/home/sections/hero/localMedia";

test("cinematic video accepts root-relative public asset paths", () => {
  assert.equal(isSafeLocalMediaPath("/media/film/hawaii.webm"), true);
  assert.equal(isSafeLocalMediaPath("/videos/intro.mp4"), true);
});

test("cinematic media renders a stable poster and CSS fallback in server HTML", () => {
  const html = renderToStaticMarkup(
    createElement(CinematicMedia, { poster: "/approved-poster.webp", sources: ["/film.webm"] })
  );
  assert.match(html, /cinematic-media__fallback/);
  assert.match(html, /approved-poster\.webp/);
  assert.doesNotMatch(html, /<video/);
});

test("cinematic navigation is centered text navigation without controls or terminal exposure", () => {
  const html = renderToStaticMarkup(createElement(NavBar));
  assert.match(html, /href="\/projects"/);
  assert.match(html, /href="\/blog"/);
  assert.match(html, /href="\/travel"/);
  assert.match(html, /href="\/about"/);
  assert.match(html, /href="\/contact"/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /href="\/terminal"/);
});

test("background media never renders controls or a clickable play action", () => {
  const html = renderToStaticMarkup(createElement(CinematicMedia, { sources: ["/film.webm"] }));
  assert.doesNotMatch(html, /<button|controls=/i);
  assert.match(html, /aria-hidden="true"/);
});

test("cinematic video rejects remote, protocol-relative, and traversal sources", () => {
  for (const source of [
    "https://media.example/film.mp4",
    "//media.example/film.mp4",
    "data:video/mp4;base64,AAAA",
    "/media/../private/film.mp4",
    "/media/%2e%2e/private/film.mp4",
    "/media\\private\\film.mp4",
    "/media/film.mp4?download=1",
  ]) {
    assert.equal(isSafeLocalMediaPath(source), false, source);
  }
});
