# Módulo Produtos e Preços (modulo-produtos-precos) — Design

## Arquitetura

O módulo `produtos-precos` está localizado em `src/modules/produtos-precos/` no backend e em `public/modules/produtos-precos/` no frontend, seguindo a arquitetura em camadas e os princípios SOLID.

### Backend (`src/modules/produtos-precos/`)

```
src/modules/produtos-precos/
├── index.js                      # Barrel export do módulo
├── controllers/
│   └── offerController.js        # Controller HTTP (Orquestração & Normalização)
├── repositories/
│   └── offerRepository.js       # Data Access Layer (DIP / Isolamento Mongoose)
├── produtosPrecosController.js    # Express Controller principal
├── produtosPrecosService.js       # Regras de Negócio & Comunicação com repositório
├── produtosPrecosRoutes.js        # Definição de Rotas Express (/api/offers)
└── produtosPrecosSchemas.js       # Schemas de Validação Zod
```

### Model & Scripts (`src/models/` & `src/scripts/`)

- **`src/models/Offer.js`**: Schema Mongoose com validação `pre("save")` para combos e suporte a `sistemaInterno` ("Easy Vendas", "VTME").
- **`src/scripts/seed-offers.js`**: Script idempotente para carga inicial de ofertas Easy Vendas no MongoDB.

### Frontend (`public/modules/produtos-precos/` & `public/modules/contratos/`)

```
public/modules/produtos-precos/
├── produtos-precos.html          # Interface HTML da Tabela de Preços
├── produtos-precos.js            # Controlador JS da página
├── produtos-precos.css           # Estilos CSS do módulo
└── components/
    └── modal/
        ├── modal-produtos-precos.js   # Controlador JS do Modal de Ofertas e Combos
        ├── modal-produtos-precos.html # Template HTML do Modal (com select sistemaInterno e tabela Combo)
        ├── combo.js                   # Lógica de cálculo bidirecional e gestão de linhas do Combo
        └── modal.css                  # Estilos específicos do Modal

public/modules/contratos/
├── components/offerManager.js    # Carregamento dinâmico de #neg-oferta via GET /api/offers?sistemaInterno=Easy+Vendas
└── contratos.js                  # Orquestrador da tela de contratos
```

### Fluxo de Dados

```
[produtos-precos.html / JS]  OR  [contratos.html / offerManager.js]
       │
       ▼ (HTTP Request GET/POST/PUT/DELETE)
[produtosPrecosRoutes.js]
       │
       ▼ (authMiddleware.protect)
[offerController.js / produtosPrecosController.js]
       │
       ▼ (Validação Zod via produtosPrecosSchemas.js)
[produtosPrecosService.js]
       │
       ▼ (Data Access)
[offerRepository.js]
       │
       ▼ (Queries & Pre-save Hook)
[Offer Model (src/models/Offer.js)]
```

## Componentes do Módulo

1. **`produtosPrecosSchemas.js`**: Define os schemas Zod para criação/edição (`createOfferSchema`, `updateOfferSchema`).
2. **`offerRepository.js`**: Isola as operações de leitura e gravação no Mongoose Model `Offer`.
3. **`produtosPrecosService.js` / `offerController.js`**: Implementa CRUD, normaliza campos de combo e aplica filtros (`sistemaInterno`, `apenasValidas`).
4. **`produtosPrecosRoutes.js`**: Expõe os endpoints `/api/offers` com autenticação e autorização.
5. **`modal-produtos-precos.js` / `combo.js`**: Componentes ES6 para criação/edição dinâmica de ofertas simples e combos no `#offerModal`.
6. **`offerManager.js`**: Consome ofertas do backend filtradas por Easy Vendas e popula o select `#neg-oferta` em contratos.
