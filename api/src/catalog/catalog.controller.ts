import { Controller, Get } from '@nestjs/common';
import { CATALOG, STORE_ITEMS, STORE_SECTIONS } from '@garden/shared';

/** The plant catalog and the Supply Store, straight from the shared rules the web app uses. */
@Controller('catalog')
export class CatalogController {
  @Get()
  get() {
    return { plants: CATALOG, store: { sections: STORE_SECTIONS, items: STORE_ITEMS } };
  }
}
