# Site language 

## Overview

Update side navigation menu to enable language selection

## Requirements

- Add a primeNG select component to the side menu. Position it so that it is at the bottom of the menu.
- The select component should have the following select items:
    English (value:en) - default language
    Deutsch (value:de)
    Francais (value:fr)
    Italiano (value: it)
- wire up the selection event to fire changeLanguage(lang: string).
- Ensure this changes the language using the translate pipe.


## References

- @context/project-overview.md