if (typeof Craft.SuperTable === typeof undefined) {
    Craft.SuperTable = {};
}

(function($){


//
// Modification of default Craft.MatrixConfigurator that properly finds the required matrix dom element
// This is especially an issue when using inside a table.
//
// addBlockType()
// '<input class="hidden" name="types[Matrix][blockTypes]['+id+'][name]">' +
// '<input class="hidden" name="types[Matrix][blockTypes]['+id+'][handle]">' +
// to
// '<input class="hidden" name="'+this.inputNamePrefix+'[blockTypes]['+id+'][name]">' +
// '<input class="hidden" name="'+this.inputNamePrefix+'[blockTypes]['+id+'][handle]">' +
//

Craft.SuperTable.MatrixConfiguratorAlt = Garnish.Base.extend({
    fieldTypeInfo: null,

    inputNamePrefix: null,
    fieldTypeSettingsNamespace: null,
    inputIdPrefix: null,

    $container: null,

    $blockTypesColumnContainer: null,
    $fieldsColumnContainer: null,
    $fieldSettingsColumnContainer: null,

    $blockTypeItemsOuterContainer: null,
    $blockTypeItemsContainer: null,
    $fieldItemsContainer: null,
    $fieldSettingItemsContainer: null,

    $newBlockTypeBtn: null,
    $newFieldBtn: null,

    blockTypes: null,
    selectedBlockType: null,
    blockTypeSort: null,
    totalNewBlockTypes: 0,

    _fieldTypeSettingsHtml: {},
    _cancelToken: null,
    _ignoreFailedRequest: false,

    init: function(fieldTypeInfo, inputNamePrefix, fieldTypeSettingsNamespace) {
        this.fieldTypeInfo = fieldTypeInfo;
        this.inputNamePrefix = inputNamePrefix;
        this.fieldTypeSettingsNamespace = fieldTypeSettingsNamespace;
        this.inputIdPrefix = Craft.formatInputId(this.inputNamePrefix);

        this.$container = $('#' + this.inputIdPrefix + '-matrix-configurator:first .input:first');

        this.$blockTypesColumnContainer = this.$container.children('.block-types').children();
        this.$fieldsColumnContainer = this.$container.children('.fields').children();
        this.$fieldSettingsColumnContainer = this.$container.children('.field-settings').children();

        this.$blockTypeItemsOuterContainer = this.$blockTypesColumnContainer.children('.items');
        this.$blockTypeItemsContainer = this.$blockTypeItemsOuterContainer.children('.blocktypes');
        this.$fieldItemsOuterContainer = this.$fieldsColumnContainer.children('.items');
        this.$fieldSettingItemsContainer = this.$fieldSettingsColumnContainer.children('.items');

        this.setContainerHeight();

        this.$newBlockTypeBtn = this.$blockTypeItemsOuterContainer.children('.btn');
        this.$newFieldBtn = this.$fieldItemsOuterContainer.children('.btn');

        // Find the existing block types
        this.blockTypes = {};

        var $blockTypeItems = this.$blockTypeItemsContainer.children();

        for (var i = 0; i < $blockTypeItems.length; i++) {
            var $item = $($blockTypeItems[i]),
                id = $item.data('id');

            this.blockTypes[id] = new BlockTypeAlt(this, $item);

            // Is this a new block type?
            var newMatch = (typeof id === 'string' && id.match(/new(\d+)/));

            if (newMatch && newMatch[1] > this.totalNewBlockTypes) {
                this.totalNewBlockTypes = parseInt(newMatch[1]);
            }
        }

        this.blockTypeSort = new Garnish.DragSort($blockTypeItems, {
            handle: '.move',
            axis: 'y'
        });

        this.addListener(this.$newBlockTypeBtn, 'click', 'addBlockType');
        this.addListener(this.$newFieldBtn, 'click', 'addFieldToSelectedBlockType');

        this.addListener(this.$blockTypesColumnContainer, 'resize', 'setContainerHeight');
        this.addListener(this.$fieldsColumnContainer, 'resize', 'setContainerHeight');
        this.addListener(this.$fieldSettingsColumnContainer, 'resize', 'setContainerHeight');
    },

    setContainerHeight: function() {
        setTimeout($.proxy(function() {
            var maxColHeight = Math.max(this.$blockTypesColumnContainer.height(), this.$fieldsColumnContainer.height(), this.$fieldSettingsColumnContainer.height(), 400);
            this.$container.height(maxColHeight);
        }, this), 1);
    },

    getFieldTypeInfo: function(type) {
        for (var i = 0; i < this.fieldTypeInfo.length; i++) {
            if (this.fieldTypeInfo[i].type === type) {
                return this.fieldTypeInfo[i];
            }
        }
    },

    addBlockType: function() {
        this.getBlockTypeSettingsModal();

        this.blockTypeSettingsModal.show();

        this.blockTypeSettingsModal.onSubmit = $.proxy(function(name, handle) {
            this.totalNewBlockTypes++;
            var id = 'new' + this.totalNewBlockTypes;

            var $item = $(
                '<div class="matrixconfigitem mci-blocktype" data-id="' + id + '">' +
                '<div class="name"></div>' +
                '<div class="handle code"></div>' +
                '<div class="actions">' +
                '<a class="move icon" title="' + Craft.t('app', 'Reorder') + '"></a>' +
                '<a class="settings icon" title="' + Craft.t('app', 'Settings') + '"></a>' +
                '</div>' +
                '<input class="hidden" name="' + this.inputNamePrefix + '[blockTypes][' + id + '][name]">' +
                '<input class="hidden" name="' + this.inputNamePrefix + '[blockTypes][' + id + '][handle]">' +
                '</div>'
            ).appendTo(this.$blockTypeItemsContainer);

            this.blockTypes[id] = new BlockTypeAlt(this, $item);
            this.blockTypes[id].applySettings(name, handle);
            this.blockTypes[id].select();
            this.blockTypes[id].addField();

            this.blockTypeSort.addItems($item);
        }, this);
    },

    addFieldToSelectedBlockType: function() {
        if (this.selectedBlockType) {
            this.selectedBlockType.addField();
        }
    },

    getBlockTypeSettingsModal: function() {
        if (!this.blockTypeSettingsModal) {
            this.blockTypeSettingsModal = new BlockTypeSettingsModalAlt();
        }

        return this.blockTypeSettingsModal;
    },

    getFieldTypeSettingsHtml: function(type) {
        return new Promise((resolve, reject) => {
            if (typeof this._fieldTypeSettingsHtml[type] !== 'undefined') {
                resolve(this._fieldTypeSettingsHtml[type]);
                return;
            }

            // Cancel the current request
            if (this._cancelToken) {
                this._ignoreFailedRequest = true;
                this._cancelToken.cancel();
                Garnish.requestAnimationFrame(() => {
                    this._ignoreFailedRequest = false;
                });
            }

            // Create a cancel token
            this._cancelToken = axios.CancelToken.source();

            Craft.sendActionRequest('POST', 'fields/render-settings', {
                cancelToken: this._cancelToken.token,
                data: {
                    type: type,
                    namespace: this.fieldTypeSettingsNamespace,
                }
            }).then(response => {
                this._fieldTypeSettingsHtml[type] = response.data;
                resolve(response.data);
            }).catch(() => {
                if (!this._ignoreFailedRequest) {
                    Craft.cp.displayError(Craft.t('app', 'A server error occurred.'));
                }
                reject();
            });
        });
    },
});


/**
* Block type settings modal class
*/
var BlockTypeSettingsModalAlt = Garnish.Modal.extend(
{
    init: function() {
        this.base();

        this.$form = $('<form class="modal fitted"/>').appendTo(Garnish.$bod);
        this.setContainer(this.$form);

        this.$body = $('<div class="body"/>').appendTo(this.$form);
        this.$nameField = $('<div class="field"/>').appendTo(this.$body);
        this.$nameHeading = $('<div class="heading"/>').appendTo(this.$nameField);
        this.$nameLabel = $('<label for="new-block-type-name">' + Craft.t('app', 'Name') + '</label>').appendTo(this.$nameHeading);
        this.$nameInstructions = $('<div class="instructions"><p>' + Craft.t('app', 'What this block type will be called in the control panel.') + '</p></div>').appendTo(this.$nameHeading);
        this.$nameInputContainer = $('<div class="input"/>').appendTo(this.$nameField);
        this.$nameInput = $('<input type="text" class="text fullwidth" id="new-block-type-name"/>').appendTo(this.$nameInputContainer);
        this.$nameErrorList = $('<ul class="errors"/>').appendTo(this.$nameInputContainer).hide();
        this.$handleField = $('<div class="field"/>').appendTo(this.$body);
        this.$handleHeading = $('<div class="heading"/>').appendTo(this.$handleField);
        this.$handleLabel = $('<label for="new-block-type-handle">' + Craft.t('app', 'Handle') + '</label>').appendTo(this.$handleHeading);
        this.$handleInstructions = $('<div class="instructions"><p>' + Craft.t('app', 'How you’ll refer to this block type in the templates.') + '</p></div>').appendTo(this.$handleHeading);
        this.$handleInputContainer = $('<div class="input"/>').appendTo(this.$handleField);
        this.$handleInput = $('<input type="text" class="text fullwidth code" id="new-block-type-handle"/>').appendTo(this.$handleInputContainer);
        this.$handleErrorList = $('<ul class="errors"/>').appendTo(this.$handleInputContainer).hide();
        this.$deleteBtn = $('<a class="error left hidden" style="line-height: 30px;">' + Craft.t('app', 'Delete') + '</a>').appendTo(this.$body);
        this.$buttons = $('<div class="buttons right" style="margin-top: 0;"/>').appendTo(this.$body);
        this.$cancelBtn = $('<div class="btn">' + Craft.t('app', 'Cancel') + '</div>').appendTo(this.$buttons);
        this.$submitBtn = $('<input type="submit" class="btn submit"/>').appendTo(this.$buttons);

        this.handleGenerator = new Craft.HandleGenerator(this.$nameInput, this.$handleInput);

        // CRAWF - By default, this will close all other Modals - nah man!
        // this.base(this.$form, {
        //     closeOtherModals: false,
        //     autoShow: false,
        // });

        this.addListener(this.$cancelBtn, 'click', 'hide');
        this.addListener(this.$form, 'submit', 'onFormSubmit');
        this.addListener(this.$deleteBtn, 'click', 'onDeleteClick');
    },

    onFormSubmit: function(ev) {
        ev.preventDefault();

        // Prevent multi form submits with the return key
        if (!this.visible) {
            return;
        }

        if (this.handleGenerator.listening) {
            // Give the handle a chance to catch up with the input
            this.handleGenerator.updateTarget();
        }

        // Basic validation
        var name = Craft.trim(this.$nameInput.val()),
            handle = Craft.trim(this.$handleInput.val());

        if (!name || !handle) {
            Garnish.shake(this.$form);
        }
        else {
            this.hide();
            this.onSubmit(name, handle);
        }
    },

    onDeleteClick: function() {
        if (confirm(Craft.t('app', 'Are you sure you want to delete this block type?'))) {
            this.hide();
            this.onDelete();
        }
    },

    show: function(name, handle, errors) {
        this.$nameInput.val(typeof name === 'string' ? name : '');
        this.$handleInput.val(typeof handle === 'string' ? handle : '');

        if (!handle) {
            this.handleGenerator.startListening();
        }
        else {
            this.handleGenerator.stopListening();
        }

        if (typeof name === 'undefined') {
            this.$deleteBtn.addClass('hidden');
            this.$submitBtn.val(Craft.t('app', 'Create'));
        }
        else {
            this.$deleteBtn.removeClass('hidden');
            this.$submitBtn.val(Craft.t('app', 'Save'));
        }

        this.displayErrors('name', (errors ? errors.name : null));
        this.displayErrors('handle', (errors ? errors.handle : null));

        if (!Garnish.isMobileBrowser()) {
            setTimeout($.proxy(function() {
                this.$nameInput.trigger('focus');
            }, this), 100);
        }

        this.base();
    },

    displayErrors: function(attr, errors) {
        var $input = this['$' + attr + 'Input'],
            $errorList = this['$' + attr + 'ErrorList'];

        $errorList.children().remove();

        if (errors) {
            $input.addClass('error');
            $errorList.show();

            for (var i = 0; i < errors.length; i++) {
                $('<li/>').text(errors[i]).appendTo($errorList);
            }
        }
        else {
            $input.removeClass('error');
            $errorList.hide();
        }
    }

});


/**
 * Block type class
 */
var BlockTypeAlt = Garnish.Base.extend({
    configurator: null,
    id: null,
    errors: null,

    inputNamePrefix: null,
    inputIdPrefix: null,

    $item: null,
    $nameLabel: null,
    $handleLabel: null,
    $nameHiddenInput: null,
    $handleHiddenInput: null,
    $settingsBtn: null,
    $fieldItemsContainer: null,
    $fieldSettingsContainer: null,

    fields: null,
    selectedField: null,
    fieldSort: null,
    totalNewFields: 0,
    fieldSettings: null,

    init: function(configurator, $item) {
        this.configurator = configurator;
        this.$item = $item;
        this.id = this.$item.data('id');
        this.errors = this.$item.data('errors');

        this.inputNamePrefix = this.configurator.inputNamePrefix + '[blockTypes][' + this.id + ']';
        this.inputIdPrefix = this.configurator.inputIdPrefix + '-blockTypes-' + this.id;

        this.$nameLabel = this.$item.children('.name');
        this.$handleLabel = this.$item.children('.handle');
        this.$nameHiddenInput = this.$item.find('input[name$="[name]"]:first');
        this.$handleHiddenInput = this.$item.find('input[name$="[handle]"]:first');
        this.$settingsBtn = this.$item.find('.settings');

        // Find the field items container if it exists, otherwise create it
        this.$fieldItemsContainer = this.configurator.$fieldItemsOuterContainer.children('[data-id="' + this.id + '"]:first');

        if (!this.$fieldItemsContainer.length) {
            this.$fieldItemsContainer = $('<div data-id="' + this.id + '"/>').insertBefore(this.configurator.$newFieldBtn);
        }

        // Find the field settings container if it exists, otherwise create it
        this.$fieldSettingsContainer = this.configurator.$fieldSettingItemsContainer.children('[data-id="' + this.id + '"]:first');

        if (!this.$fieldSettingsContainer.length) {
            this.$fieldSettingsContainer = $('<div data-id="' + this.id + '"/>').appendTo(this.configurator.$fieldSettingItemsContainer);
        }

        // Find the existing fields
        this.fields = {};

        var $fieldItems = this.$fieldItemsContainer.children();

        for (var i = 0; i < $fieldItems.length; i++) {
            var $fieldItem = $($fieldItems[i]),
                id = $fieldItem.data('id');

            this.fields[id] = new FieldAlt(this.configurator, this, $fieldItem);

            // Is this a new field?
            var newMatch = (typeof id === 'string' && id.match(/new(\d+)/));

            if (newMatch && newMatch[1] > this.totalNewFields) {
                this.totalNewFields = parseInt(newMatch[1]);
            }
        }

        this.addListener(this.$item, 'click', 'select');
        this.addListener(this.$settingsBtn, 'click', 'showSettings');

        this.fieldSort = new Garnish.DragSort($fieldItems, {
            handle: '.move',
            axis: 'y',
            onSortChange: $.proxy(function() {
                // Adjust the field setting containers to match the new sort order
                for (var i = 0; i < this.fieldSort.$items.length; i++) {
                    var $item = $(this.fieldSort.$items[i]),
                        id = $item.data('id'),
                        field = this.fields[id];

                    field.$fieldSettingsContainer.appendTo(this.$fieldSettingsContainer);
                }
            }, this)
        });
    },

    select: function() {
        if (this.configurator.selectedBlockType === this) {
            return;
        }

        if (this.configurator.selectedBlockType) {
            this.configurator.selectedBlockType.deselect();
        }

        this.configurator.$fieldsColumnContainer.removeClass('hidden').trigger('resize');
        this.$fieldItemsContainer.removeClass('hidden');
        this.$item.addClass('sel');
        this.configurator.selectedBlockType = this;
    },

    deselect: function() {
        this.$item.removeClass('sel');
        this.configurator.$fieldsColumnContainer.addClass('hidden').trigger('resize');
        this.$fieldItemsContainer.addClass('hidden');
        this.$fieldSettingsContainer.addClass('hidden');
        this.configurator.selectedBlockType = null;

        if (this.selectedField) {
            this.selectedField.deselect();
        }
    },

    showSettings: function() {
        var blockTypeSettingsModal = this.configurator.getBlockTypeSettingsModal();
        blockTypeSettingsModal.show(this.$nameHiddenInput.val(), this.$handleHiddenInput.val(), this.errors);
        blockTypeSettingsModal.onSubmit = $.proxy(this, 'applySettings');
        blockTypeSettingsModal.onDelete = $.proxy(this, 'selfDestruct');
    },

    applySettings: function(name, handle) {
        if (this.errors) {
            this.errors = null;
            this.$settingsBtn.removeClass('error');
        }

        this.$nameLabel.text(name);
        this.$handleLabel.text(handle);
        this.$nameHiddenInput.val(name);
        this.$handleHiddenInput.val(handle);
    },

    addField: function() {
        this.totalNewFields++;
        var id = 'new' + this.totalNewFields;

        var $item = $(
            '<div class="matrixconfigitem mci-field" data-id="' + id + '">' +
            '<div class="name"><em class="light">' + Craft.t('app', '(blank)') + '</em>&nbsp;</div>' +
            '<div class="handle code">&nbsp;</div>' +
            '<div class="actions">' +
            '<a class="move icon" title="' + Craft.t('app', 'Reorder') + '"></a>' +
            '</div>' +
            '</div>'
        ).appendTo(this.$fieldItemsContainer);

        this.fields[id] = new FieldAlt(this.configurator, this, $item);
        this.fields[id].select();

        this.fieldSort.addItems($item);
    },

    selfDestruct: function() {
        this.deselect();
        this.$item.remove();
        this.$fieldItemsContainer.remove();
        this.$fieldSettingsContainer.remove();

        this.configurator.blockTypes[this.id] = null;
        delete this.configurator.blockTypes[this.id];
    }

});


var FieldAlt = Garnish.Base.extend({
    configurator: null,
    blockType: null,
    id: null,

    inputNamePrefix: null,
    inputIdPrefix: null,

    selectedFieldType: null,
    initializedFieldTypeSettings: null,

    $item: null,
    $nameLabel: null,
    $handleLabel: null,

    $fieldSettingsContainer: null,
    $nameInput: null,
    $handleInput: null,
    $requiredCheckbox: null,
    $typeSelect: null,
    $translationSettingsContainer: null,
    $typeSettingsContainer: null,
    $deleteBtn: null,

    init: function(configurator, blockType, $item) {
        this.configurator = configurator;
        this.blockType = blockType;
        this.$item = $item;
        this.id = this.$item.data('id');

        this.inputNamePrefix = this.blockType.inputNamePrefix + '[fields][' + this.id + ']';
        this.inputIdPrefix = this.blockType.inputIdPrefix + '-fields-' + this.id;

        this.initializedFieldTypeSettings = {};
        this.fieldTypeSettingsTemplates = {};

        this.$nameLabel = this.$item.children('.name');
        this.$handleLabel = this.$item.children('.handle');

        // Find the field settings container if it exists, otherwise create it
        this.$fieldSettingsContainer = this.blockType.$fieldSettingsContainer.children('[data-id="' + this.id + '"]:first');

        var isNew = (!this.$fieldSettingsContainer.length);

        if (isNew) {
            this.$fieldSettingsContainer = this.getDefaultFieldSettings().appendTo(this.blockType.$fieldSettingsContainer);
        }

        this.$nameInput = $('#' + this.inputIdPrefix + '-name');
        this.$handleInput = $('#' + this.inputIdPrefix + '-handle');
        this.$requiredCheckbox = $('#' + this.inputIdPrefix + '-required');
        this.$typeSelect = $('#' + this.inputIdPrefix + '-type');
        this.$translationSettingsContainer = $('#' + this.inputIdPrefix + '-translation-settings');
        this.$typeSettingsContainer = this.$fieldSettingsContainer.children('.fieldtype-settings:first');
        this.$deleteBtn = this.$fieldSettingsContainer.children('a.delete:first');

        if (isNew) {
            this.setFieldType('craft\\fields\\PlainText');
        }
        else {
            this.selectedFieldType = this.$typeSelect.val();
            this.initializedFieldTypeSettings[this.selectedFieldType] = this.$typeSettingsContainer.children();
        }

        if (!this.$handleInput.val()) {
            new Craft.HandleGenerator(this.$nameInput, this.$handleInput);
        }

        this.addListener(this.$item, 'click', 'select');
        this.addListener(this.$nameInput, 'input', 'updateNameLabel');
        this.addListener(this.$handleInput, 'input', 'updateHandleLabel');
        this.addListener(this.$requiredCheckbox, 'change', 'updateRequiredIcon');
        this.addListener(this.$typeSelect, 'change', 'onTypeSelectChange');
        this.addListener(this.$deleteBtn, 'click', 'confirmDelete');
    },

    select: function() {
        if (this.blockType.selectedField === this) {
            return;
        }

        if (this.blockType.selectedField) {
            this.blockType.selectedField.deselect();
        }

        this.configurator.$fieldSettingsColumnContainer.removeClass('hidden').trigger('resize');
        this.blockType.$fieldSettingsContainer.removeClass('hidden');
        this.$fieldSettingsContainer.removeClass('hidden');
        this.$item.addClass('sel');
        this.blockType.selectedField = this;

        if (!Garnish.isMobileBrowser()) {
            setTimeout($.proxy(function() {
                this.$nameInput.trigger('focus');
            }, this), 100);
        }
    },

    deselect: function() {
        this.$item.removeClass('sel');
        this.configurator.$fieldSettingsColumnContainer.addClass('hidden').trigger('resize');
        this.blockType.$fieldSettingsContainer.addClass('hidden');
        this.$fieldSettingsContainer.addClass('hidden');
        this.blockType.selectedField = null;
    },

    updateNameLabel: function() {
        var val = this.$nameInput.val();
        this.$nameLabel.html((val ? Craft.escapeHtml(val) : '<em class="light">' + Craft.t('app', '(blank)') + '</em>') + '&nbsp;');
    },

    updateHandleLabel: function() {
        this.$handleLabel.html(Craft.escapeHtml(this.$handleInput.val()) + '&nbsp;');
    },

    updateRequiredIcon: function() {
        if (this.$requiredCheckbox.prop('checked')) {
            this.$nameLabel.addClass('required');
        }
        else {
            this.$nameLabel.removeClass('required');
        }
    },

    onTypeSelectChange: function() {
        this.setFieldType(this.$typeSelect.val());
    },
    
    setFieldType: function(type) {
        // Update the Translation Method settings
        Craft.updateTranslationMethodSettings(type, this.$translationSettingsContainer);

        if (this.selectedFieldType) {
            this.initializedFieldTypeSettings[this.selectedFieldType].detach();
        }

        this.selectedFieldType = type;
        this.$typeSelect.val(type);

        // Show a spinner
        this.$typeSettingsContainer.html('<div class="zilch"><div class="spinner"></div></div>');

        this.getFieldTypeSettings(type).then(({fresh, $settings, headHtml, footHtml}) => {
            this.$typeSettingsContainer.html('').append($settings);
            if (fresh) {
                Craft.initUiElements($settings);
                Craft.appendHeadHtml(headHtml);
                Craft.appendFootHtml(footHtml);
            }

            // In case Firefox was sleeping on the job
            this.$typeSettingsContainer.trigger('resize');
        }).catch(() => {
            this.$typeSettingsContainer.html('');
        });
    },

    getFieldTypeSettings: function(type) {
        return new Promise((resolve, reject) => {
            if (typeof this.initializedFieldTypeSettings[type] !== 'undefined') {
                resolve({
                    fresh: false,
                    $settings: this.initializedFieldTypeSettings[type],
                });
                return;
            }

            this.configurator.getFieldTypeSettingsHtml(type).then(({settingsHtml, headHtml, footHtml}) => {
                settingsHtml = this.getParsedFieldTypeHtml(settingsHtml);
                headHtml = this.getParsedFieldTypeHtml(headHtml);
                footHtml = this.getParsedFieldTypeHtml(footHtml);
                let $settings = $('<div/>').html(settingsHtml);
                this.initializedFieldTypeSettings[type] = $settings;
                resolve({
                    fresh: true,
                    $settings: $settings,
                    headHtml: headHtml,
                    footHtml: footHtml,
                });
            }).catch($.noop);
        });
    },

    getParsedFieldTypeHtml: function(html) {
        if (typeof html === 'string') {
            html = html.replace(/__BLOCK_TYPE_NESTED__/g, this.blockType.id);
            html = html.replace(/__FIELD_NESTED__/g, this.id);
        }
        else {
            html = '';
        }

        return html;
    },

    getDefaultFieldSettings: function() {
        var $container = $('<div/>', {
            'data-id': this.id
        });

        Craft.ui.createTextField({
            label: Craft.t('app', 'Name'),
            id: this.inputIdPrefix + '-name',
            name: this.inputNamePrefix + '[name]'
        }).appendTo($container);

        Craft.ui.createTextField({
            label: Craft.t('app', 'Handle'),
            id: this.inputIdPrefix + '-handle',
            'class': 'code',
            name: this.inputNamePrefix + '[handle]',
            maxlength: 64,
            required: true
        }).appendTo($container);

        Craft.ui.createTextareaField({
            label: Craft.t('app', 'Instructions'),
            id: this.inputIdPrefix + '-instructions',
            'class': 'nicetext',
            name: this.inputNamePrefix + '[instructions]'
        }).appendTo($container);

        Craft.ui.createCheckboxField({
            label: Craft.t('app', 'This field is required'),
            id: this.inputIdPrefix + '-required',
            name: this.inputNamePrefix + '[required]'
        }).appendTo($container);

        Craft.ui.createCheckboxField({
            label: Craft.t('app', 'Use this field’s values as search keywords?'),
            id: this.inputIdPrefix + '-searchable',
            name: this.inputNamePrefix + '[searchable]',
            checked: true,
        }).appendTo($container);

        var fieldTypeOptions = [];

        for (var i = 0; i < this.configurator.fieldTypeInfo.length; i++) {
            fieldTypeOptions.push({
                value: this.configurator.fieldTypeInfo[i].type,
                label: this.configurator.fieldTypeInfo[i].name
            });
        }

        Craft.ui.createSelectField({
            label: Craft.t('app', 'Field Type'),
            id: this.inputIdPrefix + '-type',
            name: this.inputNamePrefix + '[type]',
            options: fieldTypeOptions,
            value: 'craft\\fields\\PlainText'
        }).appendTo($container);

        if (Craft.isMultiSite) {
            var $translationSettingsContainer = $('<div/>', {
                id: this.inputIdPrefix + '-translation-settings'
            }).appendTo($container);

            Craft.ui.createSelectField({
                label: Craft.t('app', 'Translation Method'),
                id: this.inputIdPrefix + '-translation-method',
                name: this.inputNamePrefix + '[translationMethod]',
                options: [],
                value: 'none',
                toggle: true,
                targetPrefix: this.inputIdPrefix + '-translation-method-'
            }).appendTo($translationSettingsContainer);

            var $translationKeyFormatContainer = $('<div/>', {
                id: this.inputIdPrefix + '-translation-method-custom',
                'class': 'hidden'
            }).appendTo($translationSettingsContainer);

            Craft.ui.createTextField({
                label: Craft.t('app', 'Translation Key Format'),
                id: this.inputIdPrefix + '-translation-key-format',
                name: this.inputNamePrefix + '[translationKeyFormat]'
            }).appendTo($translationKeyFormatContainer);
        }

        $('<hr/>').appendTo($container);

        $('<div/>', {
            'class': 'fieldtype-settings'
        }).appendTo($container);

        $('<hr/>').appendTo($container);

        $('<a/>', {
            'class': 'error delete',
            text: Craft.t('app', 'Delete')
        }).appendTo($container);

        return $container;
    },

    confirmDelete: function() {
        if (confirm(Craft.t('app', 'Are you sure you want to delete this field?'))) {
            this.selfDestruct();
        }
    },

    selfDestruct: function() {
        this.deselect();
        this.$item.remove();
        this.$fieldSettingsContainer.remove();

        this.blockType.fields[this.id] = null;
        delete this.blockType.fields[this.id];
    }

});
})(jQuery);