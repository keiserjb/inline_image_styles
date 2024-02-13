(function ($, Backdrop, CKEDITOR) {
  'use strict';

  // Ensure CKEDITOR is available
  if (typeof CKEDITOR !== 'undefined') {
    CKEDITOR.plugins.add('inline_image_styles_ckeditor', {
      init: function(editor) {
        // Allow custom data-image-style attribute on img elements.
        editor.config.extraAllowedContent = 'img[data-image-style]';
        console.log('Image Styles');

        // Listen for the dialog confirmation event
        editor.on('dialogShow', function(dialogShowEvent) {
          var dialog = dialogShowEvent.data;

          if (dialog.getName() == 'image') { // Check if the image dialog is opened
            dialog.on('ok', function(okEvent) {
              var dialog = okEvent.sender;
              var imageStyle = dialog.getValueOf('info', 'imageStyle'); // Assume you have a field for image style

              // Manipulate the image element as needed
              var imageElement = dialog.getElement().findOne('img');
              if (imageElement) {
                imageElement.setAttribute('data-image-style', imageStyle);
              }
            });
          }
        });
      }
    });
  }
}(jQuery, Backdrop, CKEDITOR));
