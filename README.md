# k2a
Turn Kindle definition lookups into Anki flashcards

Mounting Kindle on WSL:

    $ sudo mount -t drvfs f: /mnt/f

Running and generating vocab.apkg:

    $ node k2a.js -v /mnt/f/system/vocabulary/vocab.db -n vocab
