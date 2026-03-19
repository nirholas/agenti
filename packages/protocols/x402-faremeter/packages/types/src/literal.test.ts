#!/usr/bin/env pnpm tsx

import t from "tap";
import * as literal from "./literal";

await t.test("checkBasicMatching", (t) => {
  {
    const basicMatcher = literal.caseInsensitiveLiteral(
      "doIMatch",
      "idontmatch",
    );
    const res = basicMatcher.assert("doimATCH");
    t.matchOnly(res, "doimatch");
  }

  {
    const gibberish = literal.caseInsensitiveLiteral(
      "!@@###@#@#@asaabBBBSDBDB",
    );
    const res = gibberish.assert("!@@###@#@#@asaabBBBSDBDB");
    t.matchOnly(res, "!@@###@#@#@asaabbbbsdbdb");
  }

  t.end();
});

await t.test("checkEscaping", (t) => {
  {
    const singleQuote = literal.caseInsensitiveLiteral("Qu'Ote");
    const res = singleQuote.assert("qU'oTE");
    t.matchOnly(res, "qu'ote");
  }

  {
    const doubleQuote = literal.caseInsensitiveLiteral('Qu"""Ol');
    const res = doubleQuote.assert('QU"""ol');
    t.matchOnly(res, 'qu"""ol');
  }

  {
    const mixed = literal.caseInsensitiveLiteral('.."\'""Ab');
    const res = mixed.assert('.."\'""aB');
    t.matchOnly(res, '.."\'""ab');
  }

  t.end();
});
