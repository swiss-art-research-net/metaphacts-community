# Changelog

## [4.3.2] (in progress)

- Align versioning with Docker images
- Activated handlebars conditionals for backend templates
- Added `tokenizeLuceneQuery` option to Data Client component

## [4.2.2]

- Add `clearable` option to the `semantic-form-checklist-input` component, which adds a button to clear the current selection.
- Add `sari-copy-query-to-clipboard` component to copy (generated) SPARQL queries to the clipboard.
- Add `semantic-sigma-graph` component

## [4.2.1]

- Adjustments to Semantic Search Facet visualisation
- Add `sari-file-upload` component for uploading files on client side
- Add `stay` option to `mp-ldp-remove-from-container-action` component
- Enable `droppable` on `semantic-form-autocomplete-input`
- Add option `event` to `post-action` in `mp-ldp-remove-from-container-action`
    - When set emits a `Component.Refresh` event
## [4.2.0]

- Moved custom components to separate `sari` project
## [4.1.3]

- Added additional `sari-resource-thumbnail` component that retreives the thumbnail for a resource and can be customised through the templating mechanism.
## [4.1.2]

- Added a workaround for label bug in Mirador viewer
- Implemented native confirmation dialog for annotation deletion to prevent collision when Mirador is used in Bootstrap dialog

## [4.1.1]

### Changed

- Upgraded Log4J version