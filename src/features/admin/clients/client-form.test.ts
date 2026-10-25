// Client form validation: required fields, e-mail format and normalization.
import { describe, expect, it } from "vitest";

import { emptyDraft, parseDraft } from "./client-form";

const valid = () => ({
  ...emptyDraft(),
  display_name: "Ana",
  business_name: "Ana Studio",
  email: "ana@studio.com.br",
});

describe("parseDraft", () => {
  it("trims fields and normalizes the e-mail", () => {
    expect(
      parseDraft({
        display_name: "  Ana ",
        business_name: " Ana Studio ",
        profession: " Fotógrafa ",
        email: "  Ana@Studio.COM.br ",
        phone: " (11) 90000-0000 ",
      }),
    ).toEqual({
      input: {
        display_name: "Ana",
        business_name: "Ana Studio",
        profession: "Fotógrafa",
        email: "ana@studio.com.br",
        phone: "(11) 90000-0000",
      },
    });
  });

  it("requires display and business names, rejecting whitespace only", () => {
    expect(parseDraft({ ...valid(), display_name: "   " })).toEqual({
      error: "Informe o nome de exibição.",
    });
    expect(parseDraft({ ...valid(), business_name: "\t " })).toEqual({
      error: "Informe o nome do negócio.",
    });
  });

  it("requires a valid e-mail", () => {
    expect(parseDraft({ ...valid(), email: "  " })).toEqual({ error: "Informe o e-mail." });
    for (const email of ["ana", "ana@", "ana@studio", "a na@studio.com", "@studio.com"]) {
      expect(parseDraft({ ...valid(), email })).toHaveProperty("error");
    }
  });

  it("keeps profession and phone optional", () => {
    expect(parseDraft(valid())).toHaveProperty("input.profession", "");
    expect(parseDraft(valid())).toHaveProperty("input.phone", "");
  });
});
