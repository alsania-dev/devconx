SHELL := /bin/bash

.PHONY: install build lint test check clean

install:
	npm install

build:
	npm run build

lint:
	npm run lint

test:
	npm test

check:
	npm run check

clean:
	rm -rf dist
