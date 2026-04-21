import Swal from 'sweetalert2';

const PaperSwal = Swal.mixin({
  background: '#2d1757',
  color: '#ede6f7',
  confirmButtonColor: '#7c3aed',
  cancelButtonColor: '#3b1a6e',
  customClass: {
    popup:          'paper-swal-popup',
    confirmButton:  'paper-swal-confirm',
    cancelButton:   'paper-swal-cancel',
    title:          'paper-swal-title',
    htmlContainer:  'paper-swal-html',
  },
});

export default PaperSwal;

export function swalConfirm(title: string, text?: string, confirmText = 'Eliminar') {
  return PaperSwal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  });
}

export function swalConfirmDanger(title: string, html?: string, confirmText = 'Eliminar') {
  return PaperSwal.fire({
    title,
    html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: '#ef4444',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  });
}

export function swalInfo(title: string, text?: string) {
  return PaperSwal.fire({ title, text, icon: 'info' });
}
