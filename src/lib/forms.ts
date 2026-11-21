// Utilitaires de formulaires côté navigateur.
import { startTransition } from "react";

/**
 * Envoie un formulaire à une action serveur SANS la réinitialisation automatique de React 19.
 *
 * Avec <form action={…}>, React appelle form.reset() après chaque envoi. Pour un formulaire
 * dont les valeurs sont gérées par React (champs « contrôlés »), c'est inutile et dangereux :
 * les interrupteurs et listes Radix écoutent cet événement et reviennent à leur valeur de
 * départ, ce qui annulait silencieusement les choix de l'admin après une erreur de saisie.
 *
 * Usage : <form onSubmit={submitWithoutReset(formAction)}>  (formAction vient de useActionState)
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
