# -*- makefile-gmake -*-

include config.mk


.DEFAULT_GOAL := all
DOC-PREFIX := $(patsubst ./%,%,$(patsubst %/,%,$(or $(DOCS),.)))
BOOK-NAMES := $(foreach book,$(BOOKS),$(notdir $(patsubst %/,%,$(dir $(book)))))
book_name = $(notdir $(patsubst %/,%,$(dir $(1))))
needs_cmd = $(if $(shell command -v $(1) 2>&1),,$(error Required command not found: $(1)))

define book_task
$(1): $$(DOC-PREFIX)/$(1) $$(DOC-PREFIX)/$(1)/book.json

# Create root directory for book, if needed
$$(DOC-PREFIX)/$(1):
	mkdir -p "$$@"

# Download the JSON file containing the book's metadata and index
$$(DOC-PREFIX)/$(1)/book.json: $$(DOC-PREFIX)/$(1)
	cd "$$(@D)" && wget "$(2)"
endef

$(foreach book,$(BOOKS),$(eval $(call book_task,$(call book_name,$(book)),$(book))))


all: $(BOOK-NAMES)

clean:
	rm -rf $(DOC-PREFIX)

# Temporary location to store “purified” copies of documentation
%.html/..namedfork/rsrc: %.html
	@ $(call needs_cmd,htmlq)
	htmlq -r script -r style -r 'link[rel=stylesheet i]' -f "$^" '#contents' > "$@"
