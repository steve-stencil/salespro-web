import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for price guide denormalized counter triggers.
 * These triggers automatically maintain count fields to avoid expensive JOINs.
 *
 * Triggers created:
 * - linkedMsiCount on price_guide_option (from measure_sheet_item_option)
 * - linkedMsiCount on up_charge (from measure_sheet_item_up_charge)
 * - linkedMsiCount on additional_detail_field (from measure_sheet_item_additional_detail_field)
 * - linkedUpChargeCount on additional_detail_field (from up_charge_additional_detail_field)
 */
export class Migration20251227180000 extends Migration {
  override up(): void {
    // Trigger function for price_guide_option.linked_msi_count
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_option_linked_msi_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE price_guide_option
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.option_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE price_guide_option
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.option_id;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' AND OLD.option_id IS DISTINCT FROM NEW.option_id THEN
          UPDATE price_guide_option
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.option_id;
          UPDATE price_guide_option
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.option_id;
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    this.addSql(`
      CREATE TRIGGER trg_measure_sheet_item_option_count
      AFTER INSERT OR DELETE OR UPDATE OF option_id
      ON measure_sheet_item_option
      FOR EACH ROW
      EXECUTE FUNCTION update_option_linked_msi_count();
    `);

    // Trigger function for up_charge.linked_msi_count
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_upcharge_linked_msi_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE up_charge
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.up_charge_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE up_charge
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.up_charge_id;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' AND OLD.up_charge_id IS DISTINCT FROM NEW.up_charge_id THEN
          UPDATE up_charge
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.up_charge_id;
          UPDATE up_charge
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.up_charge_id;
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    this.addSql(`
      CREATE TRIGGER trg_measure_sheet_item_up_charge_count
      AFTER INSERT OR DELETE OR UPDATE OF up_charge_id
      ON measure_sheet_item_up_charge
      FOR EACH ROW
      EXECUTE FUNCTION update_upcharge_linked_msi_count();
    `);

    // Trigger function for additional_detail_field.linked_msi_count
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_adf_linked_msi_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE additional_detail_field
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.additional_detail_field_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE additional_detail_field
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.additional_detail_field_id;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' AND OLD.additional_detail_field_id IS DISTINCT FROM NEW.additional_detail_field_id THEN
          UPDATE additional_detail_field
          SET linked_msi_count = linked_msi_count - 1
          WHERE id = OLD.additional_detail_field_id;
          UPDATE additional_detail_field
          SET linked_msi_count = linked_msi_count + 1
          WHERE id = NEW.additional_detail_field_id;
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    this.addSql(`
      CREATE TRIGGER trg_measure_sheet_item_adf_count
      AFTER INSERT OR DELETE OR UPDATE OF additional_detail_field_id
      ON measure_sheet_item_additional_detail_field
      FOR EACH ROW
      EXECUTE FUNCTION update_adf_linked_msi_count();
    `);

    // Trigger function for additional_detail_field.linked_up_charge_count
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_adf_linked_upcharge_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE additional_detail_field
          SET linked_up_charge_count = linked_up_charge_count + 1
          WHERE id = NEW.additional_detail_field_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE additional_detail_field
          SET linked_up_charge_count = linked_up_charge_count - 1
          WHERE id = OLD.additional_detail_field_id;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' AND OLD.additional_detail_field_id IS DISTINCT FROM NEW.additional_detail_field_id THEN
          UPDATE additional_detail_field
          SET linked_up_charge_count = linked_up_charge_count - 1
          WHERE id = OLD.additional_detail_field_id;
          UPDATE additional_detail_field
          SET linked_up_charge_count = linked_up_charge_count + 1
          WHERE id = NEW.additional_detail_field_id;
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    this.addSql(`
      CREATE TRIGGER trg_up_charge_adf_count
      AFTER INSERT OR DELETE OR UPDATE OF additional_detail_field_id
      ON up_charge_additional_detail_field
      FOR EACH ROW
      EXECUTE FUNCTION update_adf_linked_upcharge_count();
    `);
  }

  override down(): void {
    // Drop triggers
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_measure_sheet_item_option_count ON measure_sheet_item_option;`,
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_measure_sheet_item_up_charge_count ON measure_sheet_item_up_charge;`,
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_measure_sheet_item_adf_count ON measure_sheet_item_additional_detail_field;`,
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_up_charge_adf_count ON up_charge_additional_detail_field;`,
    );

    // Drop trigger functions
    this.addSql(`DROP FUNCTION IF EXISTS update_option_linked_msi_count();`);
    this.addSql(`DROP FUNCTION IF EXISTS update_upcharge_linked_msi_count();`);
    this.addSql(`DROP FUNCTION IF EXISTS update_adf_linked_msi_count();`);
    this.addSql(`DROP FUNCTION IF EXISTS update_adf_linked_upcharge_count();`);
  }
}
