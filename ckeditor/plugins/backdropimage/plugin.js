/**
 * @file
 * Backdrop CKEditor 4 Image plugin.
 *
 * This alters the existing CKEditor image2 widget plugin to:
 * - require a data-file-id attribute (which Backdrop uses to track where images
 *   are being used)
 * - use a Backdrop-native dialog (that is in fact just an alterable Backdrop form
 *   like any other) instead of CKEditor's own dialogs.
 *   @see \Backdrop\editor\Form\EditorImageDialog
 */
(function ($, Backdrop, CKEDITOR) {

"use strict";

CKEDITOR.plugins.add('backdropimage', {
  requires: 'image2,uploadwidget',

  beforeInit: function (editor) {
    // Override the image2 widget definition to require and handle the
    // additional data-file-id attribute.
    editor.on('widgetDefinition', function (event) {
      var widgetDefinition = event.data;
      console.log("Widget Definition Event Called", widgetDefinition.name);
      if (widgetDefinition.name !== 'image') {
        return;
      }

      // Override requiredContent & allowedContent.
      widgetDefinition.requiredContent = 'img[alt,src,width,height]';
      widgetDefinition.allowedContent.img.attributes += ',data-file-id, data-image-style';
      // We don't allow <figure>, <figcaption>, <div> or <p>  in our downcast.
      delete widgetDefinition.allowedContent.figure;
      delete widgetDefinition.allowedContent.figcaption;
      delete widgetDefinition.allowedContent.div;
      delete widgetDefinition.allowedContent.p;

      // Override downcast(): since we only accept <img> in our upcast method,
      // the element is already correct. We only need to update the element's
      // data-file-id attribute.
      widgetDefinition.downcast = function (element) {
        console.log('Downcast called for element:', element);
        //element.attributes['data-file-id'] = this.data['data-file-id'];
        if (this.data['data-file-id'] && this.data['data-file-id'] != '') {
          element.attributes['data-file-id'] = this.data['data-file-id'];
        } else if (element.attributes['data-file-id']) {
          delete element.attributes['data-file-id'];
        }
        //element.attributes['data-image-style'] = this.data['data-image-style'];
        if (this.data['data-image-style'] && this.data['data-image-style'] != 'none') {
          element.attributes['data-image-style'] = this.data['data-image-style'];
        } else if (element.attributes['data-image-style']) {
          delete element.attributes['data-image-style'];
        }
      };
      // We want to upcast <img> elements to a DOM structure required by the
      // image2 widget; we only accept an <img> tag, and that <img> tag MAY
      // have a data-file-id attribute.
      widgetDefinition.upcast = function (element, data) {
        console.log('Upcast called for element:', element.name);
        if (element.name !== 'img') {
          return;
        }
        // Don't initialize on pasted fake objects.
        else if (element.attributes['data-cke-realelement']) {
          return;
        }

        // Parse the data-file-id attribute.
        if (element.attributes['data-file-id']) {
          data['data-file-id'] = element.attributes['data-file-id'];
        }
        else {
          data['data-file-id'] = null;
        }
        if (element.attributes['data-image-style']) {
          data['data-image-style'] = element.attributes['data-image-style'];
        }
        else {
          data['data-image-style'] = 'none';
        }
        console.log('Upcast data:', data);
        return element;
      };

      // Overrides default implementation. Used to populate the "classes"
      // property of the widget's "data" property, which is used for the
      // "widget styles" functionality
      // (http://docs.ckeditor.com/#!/guide/dev_styles-section-widget-styles).
      // Is applied to whatever the main element of the widget is (<figure> or
      // <img>). The classes in image2_captionedClass are always added due to
      // a bug in CKEditor. In the case of drupalimage, we don't ever want to
      // add that class, because the widget template already contains it.
      // @see http://dev.ckeditor.com/ticket/13888
      // @see https://www.drupal.org/node/2268941
      var originalGetClasses = widgetDefinition.getClasses;
      widgetDefinition.getClasses = function () {
        var classes = originalGetClasses.call(this);
        var captionedClasses = (this.editor.config.image2_captionedClass || '').split(/\s+/);

        if (captionedClasses.length && classes) {
          for (var i = 0; i < captionedClasses.length; i++) {
            if (captionedClasses[i] in classes) {
              delete classes[captionedClasses[i]];
            }
          }
        }

        return classes;
      };

      // Protected; keys of the widget data to be sent to the Backdrop dialog.
      // Keys in the hash are the keys for image2's data, values are the keys
      // that the Backdrop dialog uses.
      widgetDefinition._mapDataToDialog = {
        'src': 'src',
        'alt': 'alt',
        'width': 'width',
        'height': 'height',
        'data-file-id': 'data-file-id',
        'data-image-style': 'data-image-style'
      };

      // Protected; transforms widget's data object to the format used by the
      // \Backdrop\editor\Form\EditorImageDialog dialog, keeping only the data
      // listed in widgetDefinition._dataForDialog.
      widgetDefinition._dataToDialogValues = function (data) {
        var dialogValues = {};
        var map = widgetDefinition._mapDataToDialog;
        Object.keys(widgetDefinition._mapDataToDialog).forEach(function (key) {
          dialogValues[map[key]] = data[key];
        });
        return dialogValues;
      };

      // Protected; the inverse of _dataToDialogValues.
      widgetDefinition._dialogValuesToData = function (dialogReturnValues) {
        var data = {};
        var map = widgetDefinition._mapDataToDialog;
        Object.keys(widgetDefinition._mapDataToDialog).forEach(function (key) {
          if (dialogReturnValues.hasOwnProperty(map[key])) {
            data[key] = dialogReturnValues[map[key]];
          }
        });
        return data;
      };

      // Protected; creates Backdrop dialog save callback.
      widgetDefinition._createDialogSaveCallback = function (editor, widget) {
        return function (dialogReturnValues) {
          var firstEdit = !widget.ready;

          // Dialog may have blurred the widget. Re-focus it first.
          if (!firstEdit) {
            widget.focus();
          }

          editor.fire('saveSnapshot');

          // Pass `true` so DocumentFragment will also be returned.
          var container = widget.wrapper.getParent(true);
          var image = widget.parts.image;

          // Set the updated widget data, after the necessary conversions from
          // the dialog's return values.
          // Note: on widget#setData this widget instance might be destroyed.
          var data = widgetDefinition._dialogValuesToData(dialogReturnValues.attributes);
          widget.setData(data);
          // Retrieve the widget once again. It could've been destroyed
          // when shifting state, so might deal with a new instance.
          widget = editor.widgets.getByElement(image);

          // It's first edit, just after widget instance creation, but before it was
          // inserted into DOM. So we need to retrieve the widget wrapper from
          // inside the DocumentFragment which we cached above and finalize other
          // things (like ready event and flag).
          if (firstEdit) {
            editor.widgets.finalizeCreation(container);
          }

          setTimeout(function () {
            // (Re-)focus the widget.
            widget.focus();
            // Save snapshot for undo support.
            editor.fire('saveSnapshot');
          });
          // Example place to add logging might be in dialog definition or save callback
          console.log("Dialog Save Callback", dialogReturnValues);
          return widget;
        };
      };

      var originalInit = widgetDefinition.init;
      widgetDefinition.init = function () {
        originalInit.call(this);
        // Update data.link object with attributes if the link has been
        // discovered.
        // @see plugins/image2/plugin.js/init() in CKEditor; this is similar.
        if (this.parts.link && !this.data.link) {
          this.setData('link', CKEDITOR.plugins.image2.getLinkAttributesParser()(editor, this.parts.link));
        }
      };

      // Add a widget#edit listener to every instance of image2 widget in order
      // to handle its editing with a Backdrop-native dialog.
      // This includes also a case just after the image was created
      // and dialog should be opened for it for the first time.
      editor.widgets.on('instanceCreated', function (event) {
        var widget = event.data;

        if (widget.name !== 'image') {
          return;
        }

        widget.on('edit', function (event) {
          // Cancel edit event to break image2's dialog binding
          // (and also to prevent automatic insertion before opening dialog).
          event.cancel();

          // Open backdropimage dialog.
          editor.execCommand('editbackdropimage', {
            existingValues: widget.definition._dataToDialogValues(widget.data),
            saveCallback: widget.definition._createDialogSaveCallback(editor, widget)
          });
        });
      });
    });

    // Register the "editbackdropimage" command, which essentially just replaces
    // the "image" command's CKEditor dialog with a Backdrop-native dialog.
    editor.addCommand('editbackdropimage', {
      allowedContent: 'img[alt,!src,width,height,!data-file-id,!data-image-style]',
      requiredContent: 'img[alt,src,width,height,data-file-id,data-image-style]',
      modes: {wysiwyg: 1},
      canUndo: true,
      exec: function (editor, data) {
        // Default to uploads being enabled, unless specifically requested not
        // to be. Access permission is checked in the back-end form itself, this
        // is just to prevent UX confusion from allowing uploads but then having
        // them cleaned up by Backdrop's temporary file cleanup.
        var uploadsEnabled = editor.element.$.getAttribute('data-editor-uploads') === 'false' ? 0 : 1;
        var dialogSettings = {
          title: data.dialogTitle,
          uploads: uploadsEnabled,
          dialogClass: 'editor-image-dialog'
        };
        var url = editor.config.backdrop.imageDialogUrl;
        if (url.indexOf('?token=') < 0) {
          url += '/' + editor.config.backdrop.format;
        }
        Backdrop.ckeditor.openDialog(editor, editor.config.backdrop.imageDialogUrl, data.existingValues, data.saveCallback, dialogSettings);
      }
    });

        // Register the toolbar button.
        if (editor.ui.addButton) {
          editor.ui.addButton('BackdropImage', {
            label: Backdrop.t('Image'),
            // Note that we use the original image2 command!
            command: 'image',
            icon: this.path + '/image.png'
          });
        }
      },

      init: function (editor) {
    },

    afterInit: function (editor) {
      linkCommandIntegrator(editor);
    }

  });

  /**
   * Integrates the backdropimage widget with the backdroplink plugin.
   *
   * Makes images linkable.
   *
   * @param {CKEDITOR.editor} editor
   *   A CKEditor instance.
   */
  function linkCommandIntegrator(editor) {
    // Nothing to integrate with if the backdroplink plugin is not loaded.
    if (!editor.plugins.backdroplink) {
      return;
    }

    // Override default behaviour of 'backdropunlink' command.
    editor.getCommand('backdropunlink').on('exec', function (evt) {
      var widget = getFocusedWidget(editor);

      // Override 'backdropunlink' only when link truly belongs to the widget. If
      // wrapped inline widget in a link, let default unlink work.
      // @see https://dev.ckeditor.com/ticket/11814
      if (!widget || !widget.parts.link) {
        return;
      }

      widget.setData('link', null);

      // Selection (which is fake) may not change if unlinked image in focused
      // widget, i.e. if captioned image. Let's refresh command state manually
      // here.
      this.refresh(editor, editor.elementPath());

      evt.cancel();
    });

    // Override default refresh of 'backdropunlink' command.
    editor.getCommand('backdropunlink').on('refresh', function (evt) {
      var widget = getFocusedWidget(editor);

      if (!widget) {
        return;
      }

      // Note that widget may be wrapped in a link, which
      // does not belong to that widget (#11814).
      this.setState(widget.data.link || widget.wrapper.getAscendant('a') ?
        CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED);

      evt.cancel();
    });
  }

  /**
   * Gets the focused widget, if of the type specific for this plugin.
   *
   * @param {CKEDITOR.editor} editor
   *   A CKEditor instance.
   *
   * @return {?CKEDITOR.plugins.widget}
   *   The focused image2 widget instance, or null.
   */
  function getFocusedWidget(editor) {
    var widget = editor.widgets.focused;

    if (widget && widget.name === 'image') {
      return widget;
    }

    return null;
  }

  // Expose an API for other plugins to interact with backdropimage widgets.
  CKEDITOR.plugins.backdropimage = {
    getFocusedWidget: getFocusedWidget
  };

})(jQuery, Backdrop, CKEDITOR);
