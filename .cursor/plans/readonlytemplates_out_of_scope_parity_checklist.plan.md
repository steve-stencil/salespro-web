# Out-of-scope parity checklist (future work)

This file intentionally captures **iOS behaviors that are out of scope for** `template_selection_grid_ios_parity.plan.md`, so they are not forgotten.**Parity principle**: Match iOS behavior exactly, but implement with maintainable, testable web architecture.---

## A) PDF preview experience

- [ ] **Generate PDF for preview** (from selected documents + user-entered form values + photos/signatures)
- **iOS source of truth**: `leap-one/Estimate Pro/ContractObjectSelectionCollectionViewController.m` → `-drawContractAndShow`
- **Engine orchestration**: `leap-one/Estimate Pro/ContractObjectManager.swift` → `promiseDrawContract()` / `promiseBuildContract(...)`
- [ ] **Preview UI** (open PDF, refresh page after redraw)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-drawContractAndShow` (creates `SSContractPreviewViewController`)
- [ ] **Missing images UX** (internet-aware messaging; copy missing URLs)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-drawContractAndShow` (missingImages alert; copy to clipboard)
- [ ] **Disable/enable preview actions based on config** (review/print toggles)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-drawContractAndShow` (`disableReviewButton`, `disablePrintButton`)
- **Config lookup**: `ContractObjectSelectionCollectionViewController.m` → `-uploadConfig`

---

## B) Signing & initials (local capture + remote DocuSign capture)

- [ ] **Determine which signatures/initials exist and are required**
- **iOS source of truth**: `leap-one/Estimate Pro/ContractObjectManager.swift`
  - signature discovery (delegate callbacks): `addSignature(withFooterTitle:idNumber:note:pageNumber:)`, `addInitialsString(_:withId:note:required:)`
  - “needs initials” rule: `needsInitialsCaptured()`
- [ ] **Show sign button only when signatures exist**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-drawContractAndShow` (`showSignButton = signaturePages.count ? YES : NO`)
- [ ] **Signature capture UI & flow**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m`
  - `-contractPreviewViewController:tappedSignButton:`
  - `-addCapturedSignature:docuSign:fromSignatureView:viewController:`
  - initials callbacks: `-contractPreviewViewController:didAddCapturedInitials:withId:`
- [ ] **Signer-grouped signing flow (LaunchDarkly gated)**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m`
  - flag check: `LaunchDarklyFlagSignerGroupedSigning`
  - grouped flow: `handleSignerGroupedSignatureCompletion(...)`, `showSignatureAtCurrentIndexForViewController:withSignatureView:`
- **Signer utilities**: `ContractObjectManager.swift` → `uniqueSigners()`, `signatures(forSigner:)`, `signaturePagesByGroupedSigner()`
- [ ] **Persist/save signature toggle behavior** (if applicable)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `SignatureCaptureView` usage (`configureSaveSignatureSwitch`, per-signer reconfigure)
- [ ] **Re-render preview after each captured signature/initials**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → redraw + `refreshPage`

---

## C) Send flow (uploading, email verification, brochures, analytics)

- [ ] **Send button gating on required initials**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-contractPreviewViewController:tappedSendButton:`
- [ ] **Prompt user if no remote signatures/initials detected (LaunchDarkly gated)**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-contractPreviewViewController:tappedSendButton:` (flag `LaunchDarklyFlagPromptUserWhetherToSendContractOrNot`)
- [ ] **Brochure/email-links selection (config gated)**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `_contractPreviewViewController:tappedSendButton:`
- **Brochure flow**: `-brochureSelectionTableViewController:didTapButton:`
- [ ] **Email verification dialog before send (config gated)**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-showVerifyEmailAlertOnViewController:block:` and send call sites
- [ ] **Generate final PDF file name & cache it**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-sendContractWithBrochureDicts:`
- [ ] **Upload images referenced by templates** (photo objects tied to engine session)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-sendContractWithBrochureDicts:` (creates `ImageObject` per `photoObject`)
- [ ] **Send/upload PDF with metadata** (session id, template ids, links)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `UploadUtility promiseSendFileWithName:...templateIds:...`
- [ ] **Attach combined DocuSign objects to estimate**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `allCombinedDocuSignObjects` + `addDocuSignObjects`
- **Combination logic**: `ContractObjectManager.swift` → `allCombinedDocuSignObjects()`
- [ ] **Analytics + logging parity** (contract sent metrics; save/open saved document event properties)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-sendContractWithBrochureDicts:`

---

## D) Payment flows (if contractData includes payment cell types)

If templates contain payment-related cell types, parity likely requires implementing these flows (or explicitly excluding those templates/cells in web).

- [ ] **Payment method permissions check** (read/write permissions)
- **iOS source of truth**: `leap-one/Estimate Pro/SinglePageContractFormTableViewController.m`
  - permission check: `checkUserPermissions` cloud call
  - messages: `kPaymentMethodReadWritePermissionRequired`, etc.
- [ ] **LeapPay association + settings loading** (company + office aware)
- **iOS source of truth**: `SinglePageContractFormTableViewController.m` → `-getDefaultPaymentMethodWithIndexPath:`
- [ ] **Payment capture UI flow** (credit card, bank account, omnibus cell)
- **iOS source of truth**: `SinglePageContractFormTableViewController.m`
  - segues: `CreditCardFormSegue`, `BankAccountFormSegue`, `PaymentCaptureFormSegue`
  - delegates: `CreditCardFormDelegate`, `BankAccountFormDelegate`, `PaymentCaptureViewControllerDelegate`
- [ ] **Write payment request into contract cell value** (and update required highlighting)
- **iOS source of truth**: `SinglePageContractFormTableViewController.m` → `-setPaymentCaptureValueForCellItem:atIndexPath:`
- [ ] **Persist payment request to estimate/customer**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m`
  - `singlePageContractFormTableViewController:didCreatePaymentRequest:`
  - `addPaymentRequestObjectToCustomerIfNeeded`

---

## E) Saved drafts / doc linking (selection persistence)

Even if templates are read-only, iOS supports saving and reopening drafts.

- [ ] **Save draft selection** (prompt name; block while uploading)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-showSaveDraftAlertOn:sender:` and `-saveButtonTapped:`
- [ ] **Upload pinned drafts** (async retry)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `SavedTemplate promiseTryUploadingPinnedTemplates`
- [ ] **Open saved draft** (confirm replace current unsaved draft; then auto-Next)
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-openButtonTapped:`, `-savedTemplatesWithViewController:selectedObjects:`
- [ ] **Interoperability with imported PDFs / report objects** when reopening drafts
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `handleSavedTemplateSelection:`

---

## F) Offline behavior

- [ ] **Offline template list caching + fallback when offline**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-loadContracts` (pinName, fromPin)

---

## G) Imported PDF documents (add from device)

- [ ] **Add PDF from device (multi-select)** and treat as selectable pages
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m`
  - `-addDocumentTapped:` (UIDocumentPicker)
  - `-documentPicker:didPickDocumentsAtURLs:` (creates imported ContractObject; thumbnail; auto-select)

---

## H) Report document insertion

- [ ] **Auto-insert measurement report “template” into the first category (config gated)**
- **iOS source of truth**: `ContractObjectSelectionCollectionViewController.m` → `-sortContracts` (creates `reportContract`)
