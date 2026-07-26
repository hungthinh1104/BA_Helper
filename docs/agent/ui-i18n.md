# UI Internationalization Guardrails

BA Helper UI internationalization is limited to product chrome, navigation,
labels, badges, buttons, and report/workspace framing.

Do not translate:

- evidence excerpts
- code excerpts
- file paths
- artifact keys
- enum values stored in contracts or the database
- backend-authored capability or lifecycle state before mapping it through a UI label

Locale identity:

- Canonical app locales are `en`, `vi-VN`, and `ja-JP`.
- Short aliases such as `vi` and `ja` may be accepted at the UI boundary, but
  must be normalized before calling backend report/localization endpoints.
- Domain glossary files may use shorter domain-pack locale ids such as `vi`,
  but report/UI locale remains canonical.

Implementation:

- Use `next-intl` for app chrome messages.
- Keep backend response fields as the source of truth.
- Frontend dictionaries may map backend enum/status values to localized labels,
  but must not invent capability or business state.
- Report markdown localization remains backend-rendered and snapshot-sourced.

