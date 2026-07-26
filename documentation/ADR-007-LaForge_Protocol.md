# ADR-007: The LaForge Protocol (Identity & Alter-Ego Isolation)

## 1. Context and Problem Statement
Within MneOS, we generate highly realistic, identity-locked AI media (often via Seedream/Seedance) using real people's biometrics as reference frames. As the system scales and explores intimate, fictional, or fantasy realms (Erato/Holodeck), a critical risk emerges: **The LaForge/Barclay Protocol Breach.**

If real-world identities (e.g., the historical timeline of a living person) cross-pollinate with their AI-generated alter-egos in the UI, the consequences range from UI confusion to profound emotional betrayal, damaged relationships, and ethical/legal violations. The real person and their fictional counterpart must never accidentally intersect in search results, timelines, or context windows.

## 2. Decision: Cryptographic UI Airgap
We are implementing strict, systemic Separation of Concerns at the tag, database, and UI levels. This ensures that the primary historical timeline (Clio) remains pristine, while the generative fantasy space (Erato) is safely siloed.

### 2.1 The Pseudonym Airgap
Alter-ego tags must never share string commonalities with the real-world identity.
* **Prohibited:** Naming an alter-ego `@Ruthie_Erato` or `@Ruthie_Dream`.
* **Mandated:** The alter-ego must use a distinct pseudonym (e.g., `@Rio`). 
* **Reasoning:** This mathematically prevents any UI fuzzy-search, autocomplete, or regex engine from accidentally suggesting the alter-ego when the user types the real person's name.

### 2.2 The Biometric One-Way Mirror (Database Level)
The AI pipeline still requires the real person's reference frames to maintain biometric fidelity. This link is established covertly at the schema level.
* The alter-ego tag (`@Rio`) will contain a hidden property: `parent_biometric_id: "<ObjectId_of_Real_Ruthie>"`
* **Workflow:** When the Erato daemon is prompted to generate media for `@Rio`, the backend securely reads the `parent_biometric_id`, silently fetches the "Golden Frames" from the primary identity, and injects them into the generation API (e.g., Seedream). The resulting generated asset is strictly committed to the `@Rio` tag.
* **Reasoning:** The generative pipeline retains 100% anatomical/facial accuracy without the frontend UI ever knowing the original identity was referenced.

### 2.3 The Domain Filter (Reactor Shielding)
The primary MneOS user interface (driven by Clio) must operate as if the Holodeck does not exist.
* All standard timelines, media grids, and search queries must implement a hard-coded exclusion filter at the database aggregation level.
* **Implementation:** 
  ```javascript
  const baseQuery = { 
    domain: { $ne: "Erato" },
    fiction: { $ne: true } 
  };
  ```
* **Reasoning:** Unless the user explicitly toggles a "Holodeck Mode" switch or navigates to a dedicated Erato portal, fictional/generated assets are mathematically excluded from the render cycle.

## 3. Consequences
* **Positive:** Absolute protection against accidental UI exposure of intimate/fictional generations. Maintains pristine historical records for real individuals.
* **Positive:** Retains the ability to generate hyper-realistic, identity-locked media without compromising safety.
* **Negative:** Slightly increased query complexity in the backend when resolving `parent_biometric_id` pointers before API dispatch.

## 4. Status
**Accepted:** June 29, 2026. Mandated for all future MatrixGrid, SovereignStudio, and Erato daemon development.
