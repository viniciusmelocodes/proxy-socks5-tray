# Proxy SOCKS5 Tray

Aplicativo para Windows que executa um proxy SOCKS5 na bandeja do sistema, permitindo iniciar, parar e acompanhar o serviço sem manter uma janela principal aberta.

## Funcionalidades

- Executa um servidor SOCKS5 na porta `1080`.
- Escuta conexões em `0.0.0.0`.
- Inicia o proxy automaticamente ao abrir o aplicativo.
- Permite iniciar e parar o proxy pelo menu da bandeja.
- Exibe uma janela com o histórico de logs.
- Registra eventos de início, parada, conexões e erros.
- Salva os logs em arquivos diários:
  `%APPDATA%\proxy-socks5-tray\logs\proxy-AAAA-MM-DD.txt`
- Impede a execução de múltiplas instâncias do aplicativo.
- Inclui instalador NSIS e versão portátil para Windows x64.

## Requisitos

- Windows 10 ou superior.
- Node.js 18 ou superior para desenvolvimento e build.

## Desenvolvimento

Instale as dependências:

```bash
npm install
```

Execute o aplicativo:

```bash
npm start
```

## Build

Gere o instalador NSIS e a versão portátil:

```bash
npm run build
```

Gere somente a versão portátil:

```bash
npm run build:portable
```

Os arquivos gerados ficam no diretório `dist`.

## Operação

O ícone do aplicativo fica na bandeja do sistema. Pelo menu, é possível:

- **Parar Proxy** ou **Iniciar Proxy**: controla o servidor SOCKS5.
- **Mostrar Logs**: abre a janela com os eventos registrados.
- **Sair**: encerra o proxy e o aplicativo.

O proxy não exige autenticação e encaminha conexões TCP para os destinos solicitados.
