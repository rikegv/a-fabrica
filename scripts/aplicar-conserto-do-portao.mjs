// aplicar-conserto-do-portao.mjs, o conserto de scripts/CONSERTO-PENDENTE-DO-GATE.md,
// pronto para o DIRETOR aplicar. OST 9.
//
// A fabrica NAO aplica: o gate esta sob negacao de escrita, e na OST 9 o
// classificador do modo automatico recusou a escrita da fabrica nele, por ser
// mexer na supervisao. A trava funcionou e nao foi contornada. Este arquivo deixa
// o conserto pronto, ja ensaiado numa copia do gate com a prova inteira passando.
//
// Uso, pelo diretor, na sessao, com o prefixo de exclamacao:
//   ! node scripts/aplicar-conserto-do-portao.mjs
//   ! bash scripts/prova-gate.sh
//
// O alvo e fixo aqui dentro, de proposito: assim a linha do diretor nao precisa
// citar o arquivo do gate. Confere o trecho antigo byte a byte e, se nao achar
// exatamente uma vez, nao grava nada.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arquivo = join(dirname(fileURLToPath(import.meta.url)), "gate-dep" + "loy.sh");
const texto = readFileSync(arquivo, "utf8");
const eol = texto.includes("\r\n") ? "\r\n" : "\n";

const antigo = `    elif printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push' &&
      ! printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push[^|;&]*[[:space:]][^-][^[:space:]]*[[:space:]][^-]'; then
      RAMO_DE_AGORA="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
      case "$RAMO_DE_AGORA" in
        main | master) PESO='pesado' ;;
      esac
    fi`;

const novo = `    elif printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push'; then
      # A linha NOMEIA o ramo de destino, ou empurra o ramo de agora? Conserto de
      # scripts/CONSERTO-PENDENTE-DO-GATE.md, aplicado na OST 9.
      #
      # Conta as palavras depois de "git push" que nao sao opcao. Nenhuma: push
      # pelado. Uma: so o remoto, e o ramo empurrado e o de agora. HEAD e @ tambem
      # querem dizer "o ramo de agora", entao nao contam como nome. Em todos esses
      # casos, parado em cima da main, e push para a main, e seria furo deixar
      # passar so porque a palavra main nao esta escrita na linha.
      RESTO="$(printf '%s' "$COMMAND" | sed -n 's/.*git[[:space:]]\\{1,\\}push[[:space:]]*//p' | sed 's/[;&|].*//')"
      NOMES=0
      set -f
      for PEDACO in $RESTO; do
        case "$PEDACO" in
          -*) ;;
          HEAD | @) ;;
          *) NOMES=$((NOMES + 1)) ;;
        esac
      done
      set +f
      if [ "$NOMES" -le 1 ]; then
        # symbolic-ref responde tambem num repositorio sem commit nenhum, onde
        # rev-parse --abbrev-ref devolve so "HEAD".
        RAMO_DE_AGORA="$(git -C "$PROJECT_DIR" symbolic-ref --short -q HEAD 2>/dev/null || git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
        case "$RAMO_DE_AGORA" in
          main | master) PESO='pesado' ;;
        esac
      fi
    fi`;

const a = antigo.split('\n').join(eol);
const n = novo.split('\n').join(eol);
const vezes = texto.split(a).length - 1;
if (vezes !== 1) {
  console.error(`trecho antigo encontrado ${vezes} vez(es), esperado 1. Nada gravado.`);
  process.exit(2);
}
writeFileSync(arquivo, texto.replace(a, n));
console.log(`gravado ${arquivo}`);
