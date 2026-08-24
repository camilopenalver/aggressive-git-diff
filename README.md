# Aggressive Git Diff

Extensión para **Cursor** y **VS Code** que resalta de forma muy visible **todos** los cambios Git actuales del workspace, siempre contra `HEAD`.

No hay recording, ni sesiones, ni snapshots. La referencia es automática:

```text
HEAD  vs  working tree actual
```

Conceptualmente: `git diff HEAD` (staged + unstaged).

## Qué hace

- Líneas **añadidas**: fondo verde en toda la línea.
- Líneas **modificadas**: fondo verde/ámbar agresivo en la línea nueva.
- Líneas **eliminadas**: indicador rojo imposible de pasar por alto (`− N deleted lines`) anclado a la línea vecina.
- Archivos **untracked**: todo el archivo se pinta como añadido.
- Al abrir un archivo que ya tenía cambios, el resaltado aparece **inmediatamente**.
- Tras un commit, si `HEAD === working tree`, el resaltado desaparece solo.
- Reacciona a cambios externos (otros agentes, scripts, checkout, branch, reset) con debounce.

## Instalación en Cursor

1. Instala el `.vsix` generado (`npm run package`).
2. En Cursor: **Extensions → … → Install from VSIX…**
3. Abre un archivo con cambios Git. El resaltado debe aparecer sin pulsar ningún botón.

También:

```bash
cursor --install-extension aggressive-git-diff-0.1.0.vsix
```

## Comandos

- `Aggressive Git Diff: Enable`
- `Aggressive Git Diff: Disable`
- `Aggressive Git Diff: Toggle`
- `Aggressive Git Diff: Refresh`

Hay un botón discreto en la status bar (`HEAD`). No hace falta usarlo: la extensión funciona sola.

## Configuración

```json
{
  "aggressiveGitDiff.enabled": true,
  "aggressiveGitDiff.addedBackground": "rgba(40, 200, 90, 0.28)",
  "aggressiveGitDiff.modifiedBackground": "rgba(40, 200, 90, 0.22)",
  "aggressiveGitDiff.deletedBackground": "rgba(255, 70, 70, 0.32)",
  "aggressiveGitDiff.opacity": 0.25,
  "aggressiveGitDiff.showDeletedIndicators": true,
  "aggressiveGitDiff.showDeletedContent": true,
  "aggressiveGitDiff.highlightWholeLine": true,
  "aggressiveGitDiff.debounceMs": 200,
  "aggressiveGitDiff.maxFileSizeKb": 1024
}
```

## Desarrollo

```bash
npm install
npm test
npm run compile
npm run build
npm run package
```

Pulsa **F5** en Cursor/VS Code con esta carpeta abierta para lanzar un Extension Development Host.

## Compatibilidad

Usa únicamente APIs públicas y estables de extensiones de VS Code (`createTextEditorDecorationType`, `setDecorations`, watchers, commands, configuration). No depende de APIs internas de Cursor.
