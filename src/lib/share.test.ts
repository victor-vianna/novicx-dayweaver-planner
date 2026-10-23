import { describe, expect, it } from "vitest";

import { mediaFilename, saveResultMessage, slugify } from "@/lib/share";

describe("slugify", () => {
  it("removes accents, symbols and repeated separators", () => {
    expect(slugify("  Café & Rotina: ação diária!  ")).toBe("cafe-rotina-acao-diaria");
  });

  it("limits the result to 48 characters", () => {
    const result = slugify("Uma publicação com um título deliberadamente muito longo para arquivo");

    expect(result).toHaveLength(48);
    expect(result).toBe("uma-publicacao-com-um-titulo-deliberadamente-mui");
  });
});

describe("mediaFilename", () => {
  it("creates a single-image filename", () => {
    expect(mediaFilename("Café da manhã", 0, 1)).toBe("cafe-da-manha.jpg");
  });

  it("numbers carousel images and falls back to arte", () => {
    expect(mediaFilename("Meu carrossel", 1, 3)).toBe("meu-carrossel-2.jpg");
    expect(mediaFilename("!!!", 0, 1)).toBe("arte.jpg");
  });
});

describe("saveResultMessage", () => {
  it("describes every completed save result", () => {
    expect(saveResultMessage("shared", 1)).toBe("Arte enviada para o compartilhamento");
    expect(saveResultMessage("shared", 2)).toBe("Artes enviadas para o compartilhamento");
    expect(saveResultMessage("zipped", 3)).toBe("Arquivo .zip com 3 artes baixado");
    expect(saveResultMessage("downloaded", 1)).toBe("Download da arte iniciado");
  });

  it("has no success message for a cancelled share", () => {
    expect(saveResultMessage("cancelled", 1)).toBeNull();
  });
});
