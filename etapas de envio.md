# Etapas de Envio — DocuSign Prepare

> Pagina alvo: `https://apps.docusign.com/send/prepare/`  
> Fonte: HTML real coletado da interface. Padrao de seletores segue `backend/src/modules/robot-docusign/selectors/docusign-ui.json`.

## Seletores (canonico `send`)

```json
{
  "send": {
    "url": "https://apps.docusign.com/send/prepare/",
    "file_input": "input[type='file']",
    "upload_button": "button[data-qa='upload-file-button']",
    "upload_container": "[data-qa='upload-button-container'][data-hotspot='upload-button-container']",
    "drop_icon": "svg[data-qa='file-drop-zone-text-image']",
    "recipient_name": "input[data-qa='recipient-name']",
    "recipient_email": "input[data-qa='recipient-email']",
    "delivery_checkbox": "input[data-qa='delivery-email']",
    "recipients_add": "button[data-qa='recipients-add']",
    "next_button": "button[data-qa='footer-add-fields-link-correct']",
    "send_button": "button[data-qa='footer-send-button']",
    "send_without_fields": "button[data-qa='send-without-fields']"
  }
}
```

## Passo a passo

### 1) Fazer upload
- **Preferencial (abre tela imediatamente):** `svg[data-qa="file-drop-zone-text-image"]` — icone `<path d="M17.63 14 L13 9.35V22h-2V9.35L6.37 14...">`
- **Fallback:** `button[data-qa="upload-file-button"]` dentro de `[data-qa="upload-button-container"][data-hotspot="upload-button-container"]` — texto `span[data-qa="upload-file-button-text"]` = "Fazer upload"
- **Input real (usado no `page.setInputFiles`):** `input[type="file"]`
- HTML referencia:
```html
<div data-delegate="ignore" data-qa="upload-button-container" data-hotspot="upload-button-container">
  <button data-qa="upload-file-button">...Fazer upload...</button>
</div>
<svg data-qa="file-drop-zone-text-image">...</svg>
```

### 2) Preencher destinatario — Nome
- **Seletor:** `input[data-qa="recipient-name"]` (`id` dinamico ex: `c3ced787e4`, ignorar id)
- **Acao:** preencher texto `"Qualidade"`
- **Fallbacks:** `input[data-testid='recipient-name'], input[name='recipientName']`
```html
<input data-qa="recipient-name" maxlength="100" aria-required="true" type="text" class="css-24iygv" />
```

### 3) Verificar entrega (checkbox)
- **Seletor:** `input[data-qa="delivery-email"][value="email"]` (`id` ex: `6ac120ef18`)
- **Acao:** verificar `checked`; se nao estiver, clicar para selecionar
```html
<input data-qa="delivery-email" type="checkbox" value="email" checked />
```

### 4) Preencher destinatario — E-mail
- **Seletor:** `input[data-qa="recipient-email"][placeholder="E-mail *"]`
- **Acao:** preencher `"qualidade@unitynordeste.com.br"` (normalizar trim+lowercase no codigo)
```html
<input data-qa="recipient-email" placeholder="E-mail *" maxlength="100" aria-required="true" type="text" />
```

### 5) Adicionar destinatario (loop se >1)
- **Seletor:** `button[data-qa="recipients-add"]` (`span[data-qa="recipients-add-text"]` = "Adicionar destinatário")
- **Acao:** clicar sempre que precisar enviar para outros destinatarios
```html
<button data-qa="recipients-add">Adicionar destinatário</button>
<button data-qa="recipients-add-menu" aria-haspopup="true">...</button>
```

### 6) Avancar
- **Seletor:** `button[data-qa="footer-add-fields-link-correct"]` (`span[data-qa="footer-add-fields-link-correct-text"]` = "Avançar")
- **Contexto:** dentro de `[data-walkthrough-step="transitionCallout"]` / `[data-callout="footer-prepare-next-action"]`
```html
<button data-qa="footer-add-fields-link-correct">Avançar</button>
```

### 7) Enviar
- **Seletor:** `button[data-qa="footer-send-button"]` (`span[data-qa="footer-send-button-text"]` = "Enviar")
- **Fallbacks:** `button[data-testid='send-button'], button[data-action='send']`
```html
<button data-qa="footer-send-button">Enviar</button>
```

### 8) Enviar sem campos (confirmacao)
- **Seletor:** `button[data-qa="send-without-fields"]` (`span[data-qa="send-without-fields-text"]` = "Enviar sem campos")
- **Quando:** apos clicar "Enviar" quando nao ha campos arrastados
```html
<button data-qa="send-without-fields">Enviar sem campos</button>
```

Concluido.
