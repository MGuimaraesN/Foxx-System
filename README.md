# Foxx System 🦊

O **Foxx System** é uma solução completa de ERP (Enterprise Resource Planning) focada na gestão de Ordens de Serviço (OS), controlo de marcas e monitorização de períodos operacionais. O sistema foi desenhado para oferecer total transparência através de logs de auditoria e garantir a segurança dos dados com ferramentas de backup integradas.

## 🚀 Tecnologias e Arquitetura

O projeto utiliza uma stack moderna baseada em TypeScript para garantir consistência entre o cliente e o servidor.

### Backend (Core)

-   **Node.js & Express**: API RESTful configurada na porta **3020**.
    
-   **Prisma ORM**: Camada de abstração de dados utilizando **SQLite** como motor de base de dados.
    
-   **Zod**: Validação rigorosa de esquemas de dados (Input Sanitization).
    
-   **Audit Logging**: Sistema nativo que regista todas as mutações de dados para conformidade.
    

### Frontend (Interface)

-   **React (Vite)**: SPA (Single Page Application) rápida e optimizada, a correr na porta **3000**.
    
-   **Tailwind CSS**: Design responsivo com suporte a temas.
    
-   **Context API**: Gestão de estado para Autenticação, Internacionalização (**i18n**) e Temas.
    
-   **Lucide React**: Iconografia moderna e leve.
    

### Infraestrutura

-   **Docker & Docker Compose**: Orquestração de containers para facilitar o deploy e desenvolvimento.
    
-   **Nginx**: Servidor web e proxy reverso para o frontend.
    

## ✨ Funcionalidades Principais

### 📊 Dashboard e Relatórios

-   Visualização de métricas de lucro total e volume de ordens.
    
-   Gráficos de distribuição por marcas e status de serviço.
    
-   Relatórios detalhados exportáveis.
    

### 🛠️ Gestão de Ordens de Serviço (OS)

-   Ciclo de vida completo: _Pendente_, _Em Progresso_, _Concluído_ e _Cancelado_.
    
-   Vinculação inteligente entre Marcas (Clientes) e Períodos de faturação.
    
-   Cálculo automático de lucro baseado em custos e valores de venda.
    

### 🏢 Marcas e Períodos

-   Registo de marcas para personalização do atendimento.
    
-   Gestão de períodos operacionais (Abertura/Fecho de meses ou ciclos).
    

### 🔐 Segurança e Auditoria

-   **Audit Log**: Registo histórico de acções (quem criou, editou ou eliminou cada entidade).
    
-   **Sistema de Backup**: Exportação de toda a base de dados em formatos **SQL** e **JSON** directamente pela interface.
    
-   **Autenticação**: Fluxo seguro de login e protecção de rotas.
    

### 🌍 UX e Personalização

-   **Multi-idioma**: Suporte total para Português (BR) e Inglês (US).
    
-   **Dark Mode**: Alternância de tema escuro e claro com persistência.
    

## 📦 Estrutura do Projeto

```
.
├── backend/
│   ├── prisma/             # Definição de modelos e ficheiro SQLite (.db)
│   ├── src/
│   │   ├── controllers/    # Lógica de Auditoria, Backup, Dashboard e OS
│   │   ├── utils/          # Helpers de períodos e datas
│   │   └── schemas.ts      # Contratos de dados com Zod
├── frontend/
│   ├── src/
│   │   ├── components/     # UI Dinâmica (Buttons, Cards, Modals)
│   │   ├── pages/          # Ecrãs de Gestão, Auditoria e Configurações
│   │   ├── services/       # Contextos (Auth, Theme, I18n) e Data Service
│   │   └── types.ts        # Tipagem global do sistema
└── docker-compose.yml      # Orquestração de containers
```

## 🛠️ Instalação e Execução

### Pré-requisitos

-   Docker e Docker Compose.
    

### Configuração Rápida

1.  **Clonar e Preparar**:
    
    ```
    git clone https://github.com/mguimaraesn/foxx-system.git
    cd foxx-system
    ```
    
2.  **Variáveis de Ambiente**:
    
    -   No directório `backend/`, crie um `.env` baseado no `.env.example`. Certifique-se de que a `DATABASE_URL` aponta para o ficheiro SQLite.
        
    -   No directório `frontend/`, configure o `.env` com `VITE_API_URL=http://localhost:3020`.
        
3.  **Subir Ambiente**:
    
    ```
    docker-compose up --build
    ```
    

### Acessos Standard

-   **Web App**: `http://localhost:3000`
    
-   **API**: `http://localhost:3020`
    
-   **Banco de Dados**: SQLite (Ficheiro local em `backend/prisma/`)
    

## 📊 Modelo de Dados (Prisma)

-   `User`: Credenciais e perfis.
    
-   `Brand`: Clientes e marcas associadas.
    
-   `Period`: Ciclos temporais de trabalho.
    
-   `ServiceOrder`: O coração do sistema, ligando lucro, datas e marcas.
    
-   `AuditLog`: Registo de rasto para segurança.
    
-   `Settings`: Configurações de sistema persistidas.
    

**Desenvolvido por** [**MGuimaraesN**](https://github.com/mguimaraesn "null")