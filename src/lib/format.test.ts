import { describe, expect, it } from "vitest";
import { currencyToCents } from "./format";

describe("currencyToCents", () => {
  it("converte o formato monetário brasileiro para centavos", () => {
    expect(currencyToCents("1.234,56")).toBe(123456);
    expect(currencyToCents("0,01")).toBe(1);
    expect(currencyToCents("7.960.000,00")).toBe(796000000);
  });

  it("mantém vazio como opcional e rejeita valores inválidos", () => {
    expect(currencyToCents("")).toBeUndefined();
    expect(currencyToCents("valor inválido")).toBeUndefined();
    expect(currencyToCents("-1,00")).toBeUndefined();
  });
});
